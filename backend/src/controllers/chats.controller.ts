import { Request, Response } from "express";
import { z } from "zod";
import { LogKind, MessageRole } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/errorHandler";
import { askAdkAgent, askAdkFeedback, AdkHistoryTurn, warmAdk } from "../services/adkClient.service";
import { getLogActor, recordInteraction } from "../services/interactionLog.service";
import { findVisibleProject } from "./projects.controller";

const HISTORY_LIMIT = 20; // últimas N mensagens mandadas como histórico pro agente

const sessionSelect = { id: true, number: true, name: true, createdAt: true } as const;

// Sessão (Chat) do próprio usuário, num projeto que ele pode ver.
async function loadSession(req: Request) {
  const { projectId, chatId } = req.params;
  const project = await findVisibleProject(req.user!, projectId);
  const chat = await prisma.chat.findFirst({ where: { id: chatId, projectId, userId: req.user!.id } });
  if (!chat) throw new HttpError(404, "Sessão não encontrada");
  return { chat, project };
}

// O agente (tanto o de resposta quanto o de feedback) só deve ver o
// diálogo real estudante<->stakeholder — mensagens de FEEDBACK são meta,
// não fazem parte da entrevista em si.
function toAdkHistory(messages: { role: MessageRole; content: string }[]): AdkHistoryTurn[] {
  return messages
    .filter((m) => m.role !== MessageRole.FEEDBACK)
    .map((m) => ({
      role: m.role === MessageRole.USER ? ("user" as const) : ("stakeholder" as const),
      content: m.content,
    }));
}

// Pede o feedback pedagógico ao ADK e registra no log (sucesso ou erro).
async function requestFeedbackLogged(params: {
  history: AdkHistoryTurn[];
  actor: Awaited<ReturnType<typeof getLogActor>>;
  chat: { sessionId: string };
  project: { id: string; title: string };
  prompt: string;
}): Promise<string> {
  const { history, actor, chat, project, prompt } = params;
  const base = {
    actor,
    kind: LogKind.FEEDBACK,
    sessionId: chat.sessionId,
    projectId: project.id,
    projectTitle: project.title,
    prompt,
    grounded: null,
    coveredByReport: null,
  };

  const startedAt = Date.now();
  try {
    const text = await askAdkFeedback(history);
    await recordInteraction({ ...base, response: text, latencyMs: Date.now() - startedAt });
    return text;
  } catch (err) {
    await recordInteraction({
      ...base,
      response: "",
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function listSessions(req: Request, res: Response) {
  warmAdk();
  const { projectId } = req.params;
  await findVisibleProject(req.user!, projectId);
  const sessions = await prisma.chat.findMany({
    where: { projectId, userId: req.user!.id },
    select: sessionSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(sessions);
}

export async function createSession(req: Request, res: Response) {
  const { projectId } = req.params;
  const userId = req.user!.id;
  await findVisibleProject(req.user!, projectId);

  // ponytail: duas criações simultâneas podem repetir o número; é só o rótulo padrão.
  const { _max } = await prisma.chat.aggregate({ where: { projectId, userId }, _max: { number: true } });
  const session = await prisma.chat.create({
    data: { projectId, userId, number: (_max.number ?? 0) + 1 },
    select: sessionSelect,
  });
  res.status(201).json(session);
}

const renameSchema = z.object({ name: z.string().trim().max(80, "Nome muito longo (máx. 80)") });

// Nome vazio volta para o padrão "Sessão N".
export async function renameSession(req: Request, res: Response) {
  const { name } = renameSchema.parse(req.body);
  const { chat } = await loadSession(req);
  const session = await prisma.chat.update({
    where: { id: chat.id },
    data: { name: name || null },
    select: sessionSelect,
  });
  res.json(session);
}

// Apaga a sessão e as mensagens dela; os logs no dashboard continuam.
export async function deleteSession(req: Request, res: Response) {
  const { chat } = await loadSession(req);
  await prisma.chat.delete({ where: { id: chat.id } });
  res.status(204).send();
}

export async function getSession(req: Request, res: Response) {
  warmAdk();
  const { chat } = await loadSession(req);

  const messages = await prisma.message.findMany({
    where: { chatId: chat.id },
    orderBy: { createdAt: "asc" },
  });

  res.json({ chatId: chat.id, messages });
}

const messageSchema = z.object({ pergunta: z.string().trim().min(1) });

export async function sendMessage(req: Request, res: Response) {
  const { pergunta } = messageSchema.parse(req.body);
  const [{ chat, project }, actor] = await Promise.all([loadSession(req), getLogActor(req.user!.id)]);

  const isSair = pergunta.trim().toLowerCase() === "sair";

  if (isSair) {
    const messages = await prisma.message.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: "asc" },
    });

    const history = toAdkHistory(messages);
    if (history.length === 0) {
      throw new HttpError(400, "Ainda não há perguntas nessa entrevista para avaliar");
    }

    await prisma.message.create({
      data: { chatId: chat.id, role: MessageRole.USER, content: pergunta },
    });

    const feedbackText = await requestFeedbackLogged({
      history,
      actor,
      chat,
      project,
      prompt: pergunta,
    });

    const feedbackMessage = await prisma.message.create({
      data: { chatId: chat.id, role: MessageRole.FEEDBACK, content: feedbackText },
    });

    return res.json({
      resposta: feedbackMessage.content,
      grounded: null,
      dataHora: feedbackMessage.createdAt,
    });
  }

  // Histórico lido ANTES de salvar a pergunta atual (assim ela não entra nele e
  // dispensa o skip). Salvar a pergunta roda em paralelo com a chamada ao ADK:
  // o aluno não precisa esperar essa ida ao banco antes de a IA começar.
  const previousMessages = await prisma.message.findMany({
    where: { chatId: chat.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });
  const history = toAdkHistory(previousMessages.reverse());

  const savingQuestion = prisma.message.create({
    data: { chatId: chat.id, role: MessageRole.USER, content: pergunta },
  });
  savingQuestion.catch(() => {}); // o erro real é tratado no await mais abaixo

  const startedAt = Date.now();
  let adkResult: Awaited<ReturnType<typeof askAdkAgent>>;
  try {
    adkResult = await askAdkAgent({
      question: pergunta,
      reportText: project.reportText,
      history,
    });
  } catch (err) {
    // Falhas do ADK também entram no log (com a mensagem de erro).
    void recordInteraction({
      actor,
      kind: LogKind.PERGUNTA,
      sessionId: chat.sessionId,
      projectId: project.id,
      projectTitle: project.title,
      prompt: pergunta,
      response: "",
      grounded: null,
      coveredByReport: null,
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  const { answer, grounded, coveredByReport } = adkResult;
  const latencyMs = Date.now() - startedAt;

  // A pergunta precisa estar salva antes da resposta (ordem no histórico).
  await savingQuestion;

  // "Não coberto pelo relatório" é o que importa pro admin revisar — inclui
  // tanto invenção (grounded=false) quanto um "não sei" honesto sobre algo
  // que o relatório simplesmente não aborda.
  const [stakeholderMessage] = await Promise.all([
    prisma.message.create({
      data: { chatId: chat.id, role: MessageRole.STAKEHOLDER, content: answer, grounded },
    }),
    coveredByReport
      ? Promise.resolve()
      : prisma.unansweredQuestion.create({
          data: { projectId: project.id, userId: req.user!.id, question: pergunta, sessionId: chat.sessionId },
        }),
  ]);

  // Log não bloqueia a resposta ao aluno (recordInteraction já trata os próprios erros).
  void recordInteraction({
    actor,
    kind: LogKind.PERGUNTA,
    sessionId: chat.sessionId,
    projectId: project.id,
    projectTitle: project.title,
    prompt: pergunta,
    response: answer,
    grounded,
    coveredByReport,
    latencyMs,
  });

  res.json({ resposta: stakeholderMessage.content, grounded, dataHora: stakeholderMessage.createdAt });
}
