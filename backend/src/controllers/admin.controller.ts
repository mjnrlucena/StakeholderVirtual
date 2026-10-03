import { Request, Response } from "express";
import { z } from "zod";
// pdf-parse não tem types oficiais completos; import via require evita
// atrito com o modo de teste automático do próprio pacote no ESM/CJS misto.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require("pdf-parse");
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/errorHandler";
import { deleteReportPdf, uploadReportPdf } from "../services/storage.service";
import {
  getLogFilterOptions,
  getSessionLogs,
  logFiltersSchema,
  searchLogs,
  summarizeLogs,
} from "../services/logSearch.service";

const createProjectSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
});

const promoteSchema = z.object({
  email: z.string().email("E-mail inválido"),
  role: z.enum([Role.PROFESSOR, Role.GESTOR, Role.ALUNO]),
});

// Só o superadmin chama (ver rota). Define o papel de um usuário já
// cadastrado: professor, gestor ou volta para aluno. O superadmin em si
// não pode ser alterado por aqui.
export async function promoteUser(req: Request, res: Response) {
  const { email, role } = promoteSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HttpError(404, "Usuário não encontrado com este e-mail");
  }
  if (user.role === Role.SUPERADMIN) {
    throw new HttpError(403, "O papel de um SuperAdmin não pode ser alterado");
  }

  const updatedUser = await prisma.user.update({
    where: { email },
    data: { role },
    select: { id: true, role: true, turma: { select: { id: true, nome: true } } },
  });

  // O papel vai dentro do access token, então vale para a pessoa no
  // próximo refresh (até 15 min) ou no próximo login.
  res.json({ message: "Papel atualizado com sucesso", user: updatedUser });
}

// Apaga o projeto e, em cascata, os chats, mensagens e perguntas não
// respondidas dele. Os logs de conversas NÃO são apagados: guardam o título
// do projeto como snapshot e continuam no dashboard.
export async function deleteProject(req: Request, res: Response) {
  const { id } = req.params;

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, pdfPath: true } });
  if (!project) throw new HttpError(404, "Projeto não encontrado");

  await prisma.project.delete({ where: { id } });
  await deleteReportPdf(project.pdfPath);

  res.status(204).send();
}

export async function listAdminProjects(_req: Request, res: Response) {
  const projects = await prisma.project.findMany({
    select: { id: true, title: true, description: true, pdfPath: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(projects);
}

export async function createProject(req: Request, res: Response) {
  if (!req.file) throw new HttpError(400, "Envie o PDF do relatório no campo 'pdf'");
  const { title, description } = createProjectSchema.parse(req.body);

  const { text } = await pdfParse(req.file.buffer);
  if (!text?.trim()) {
    throw new HttpError(422, "Não foi possível extrair texto do PDF enviado");
  }

  const pdfPath = await uploadReportPdf(req.file.buffer, req.file.originalname);

  const project = await prisma.project.create({
    data: { title, description, pdfPath, reportText: text },
  });

  res.status(201).json({ id: project.id, title: project.title });
}

export async function listUnansweredQuestions(req: Request, res: Response) {
  const onlyPending = req.query.reviewed !== "all";
  const questions = await prisma.unansweredQuestion.findMany({
    where: onlyPending ? { reviewed: false } : undefined,
    include: {
      project: { select: { id: true, title: true } },
      // Só a turma: o hub não expõe e-mail nem papel de quem perguntou.
      user: { select: { id: true, turma: { select: { id: true, nome: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(questions);
}

const answerQuestionSchema = z.object({ answer: z.string().trim().min(1) });

// O admin responde a pergunta que o relatório não cobria — a resposta é
// anexada ao reportText do projeto, então a próxima vez que alguém
// perguntar algo parecido, o stakeholder já vai ter essa informação.
export async function answerQuestion(req: Request, res: Response) {
  const { id } = req.params;
  const { answer } = answerQuestionSchema.parse(req.body);

  const question = await prisma.unansweredQuestion.findUnique({ where: { id } });
  if (!question) throw new HttpError(404, "Pergunta não encontrada");

  const complemento = `\n\nInformações adicionais do stakeholder:\nSobre "${question.question}": ${answer}`;
  const project = await prisma.project.findUniqueOrThrow({ where: { id: question.projectId } });

  const newReportText = project.reportText + complemento;

  const updated = await prisma.$transaction([
    prisma.project.update({
      where: { id: question.projectId },
      data: { reportText: newReportText },
    }),
    prisma.unansweredQuestion.update({
      where: { id },
      data: { answer, reviewed: true, answeredAt: new Date() },
    }),
  ]);

  res.json(updated[1]);
}

// Descarta a pergunta sem gerar nenhum contexto novo pro projeto.
export async function deleteQuestion(req: Request, res: Response) {
  const { id } = req.params;
  await prisma.unansweredQuestion.delete({ where: { id } });
  res.status(204).send();
}
// --- Logs de conversas (professor / superadmin) -------------------------------

export async function listLogs(req: Request, res: Response) {
  const filters = logFiltersSchema.parse(req.query);
  res.json(await searchLogs(filters));
}

export async function logsSummary(req: Request, res: Response) {
  const filters = logFiltersSchema.parse(req.query);
  res.json(await summarizeLogs(filters));
}

export async function logsFilterOptions(_req: Request, res: Response) {
  res.json(await getLogFilterOptions());
}

export async function logSession(req: Request, res: Response) {
  const logs = await getSessionLogs(req.params.sessionId);
  if (logs.length === 0) throw new HttpError(404, "Conversa não encontrada");
  res.json(logs);
}
