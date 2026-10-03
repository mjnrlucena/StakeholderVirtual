import { Request, Response } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { LogKind, MessageRole } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/errorHandler";
import { askAdkAgent, askAdkFeedback, AdkHistoryTurn, warmAdk } from "../services/adkClient.service";
import { getLogActor, recordInteraction } from "../services/interactionLog.service";

const HISTORY_LIMIT = 20; // últimas N mensagens mandadas como histórico pro agente

async function getOrCreateChat(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new HttpError(404, "Projeto não encontrado");

  const chat = await prisma.chat.upsert({
    where: { userId_projectId: { userId, projectId } },
    update: {},
    create: { userId, projectId },
  });

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

export async function getChat(req: Request, res: Response) {
  warmAdk();
  const { projectId } = req.params;
  const { chat } = await getOrCreateChat(req.user!.id, projectId);

  const messages = await prisma.message.findMany({
    where: { chatId: chat.id },
    orderBy: { createdAt: "asc" },
  });

  res.json({ chatId: chat.id, messages });
}

const messageSchema = z.object({ pergunta: z.string().trim().min(1) });

export async function sendMessage(req: Request, res: Response) {
  const { projectId } = req.params;
  const { pergunta } = messageSchema.parse(req.body);
  const [{ chat, project }, actor] = await Promise.all([
    getOrCreateChat(req.user!.id, projectId),
    getLogActor(req.user!.id),
  ]);

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
          data: { projectId, userId: req.user!.id, question: pergunta },
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

export async function sendFeedback(req: Request, res: Response) {
  const { projectId } = req.params;
  const { chat, project } = await getOrCreateChat(req.user!.id, projectId);
  const actor = await getLogActor(req.user!.id);

  const messages = await prisma.message.findMany({
    where: { chatId: chat.id },
    orderBy: { createdAt: "asc" },
  });

  const history = toAdkHistory(messages);
  if (history.length === 0) {
    throw new HttpError(400, "Ainda não há perguntas nessa entrevista para avaliar");
  }

  const feedbackText = await requestFeedbackLogged({
    history,
    actor,
    chat,
    project,
    prompt: "(feedback solicitado pelo botão)",
  });

  const feedbackMessage = await prisma.message.create({
    data: { chatId: chat.id, role: MessageRole.FEEDBACK, content: feedbackText },
  });

  res.json({ resposta: feedbackMessage.content, dataHora: feedbackMessage.createdAt });
}

export async function resetChat(req: Request, res: Response) {
  const { projectId } = req.params;
  const { chat } = await getOrCreateChat(req.user!.id, projectId);

  // Apaga as mensagens do chat atual — o registro do Chat continua o
  // mesmo (é o "slot" único do usuário para esse projeto), mas some toda
  // a memória anterior, exatamente como pedido.
  // O sessionId muda para que os logs da próxima conversa não se misturem
  // com os da anterior (os logs em si nunca são apagados).
  await prisma.$transaction([
    prisma.message.deleteMany({ where: { chatId: chat.id } }),
    prisma.chat.update({ where: { id: chat.id }, data: { sessionId: randomUUID() } }),
  ]);

  res.json({ ok: true });
}
