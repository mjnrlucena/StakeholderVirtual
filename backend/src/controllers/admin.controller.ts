import { Request, Response } from "express";
import { z } from "zod";
// pdf-parse não tem types oficiais completos; import via require evita
// atrito com o modo de teste automático do próprio pacote no ESM/CJS misto.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require("pdf-parse");
import { prisma } from "../prisma";
import { HttpError } from "../middleware/errorHandler";
import { uploadReportPdf } from "../services/storage.service";
import { askAdkAgent, updateAdkProjectIndex } from "../services/adkClient.service";

const createProjectSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
});

const addAdminSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

export async function addAdmin(req: Request, res: Response) {
  const { email } = addAdminSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HttpError(404, "Usuário não encontrado com este e-mail");
  }

  const updatedUser = await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
    select: { id: true, email: true, role: true },
  });

  res.json({ message: "Administrador adicionado com sucesso", user: updatedUser });
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
      user: { select: { id: true, email: true } },
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

  // Formatação mais natural para o RAG (veja o ponto 2 abaixo)
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

  // 🚀 NOTIFIQUE O SERVIÇO DE IA PARA REINDEXAR / ATUALIZAR OS VETORES
  if (typeof updateAdkProjectIndex === "function") {
    await updateAdkProjectIndex({
      projectId: question.projectId,
      reportText: newReportText,
    });
  }

  res.json(updated[1]);
}

// Descarta a pergunta sem gerar nenhum contexto novo pro projeto.
export async function deleteQuestion(req: Request, res: Response) {
  const { id } = req.params;
  await prisma.unansweredQuestion.delete({ where: { id } });
  res.status(204).send();
}
