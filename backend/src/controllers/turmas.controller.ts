import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/errorHandler";

// Lista enxuta para o select do cadastro (sem contagens nem dados de usuários).
export async function listPublicTurmas(_req: Request, res: Response) {
  const turmas = await prisma.turma.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  res.json(turmas);
}

// --- Gerenciamento (superadmin) -------------------------------------------

export async function listTurmasAdmin(_req: Request, res: Response) {
  const turmas = await prisma.turma.findMany({
    select: { id: true, nome: true, createdAt: true, _count: { select: { users: true } } },
    orderBy: { nome: "asc" },
  });
  res.json(turmas.map((t) => ({ id: t.id, nome: t.nome, createdAt: t.createdAt, alunos: t._count.users })));
}

const createTurmaSchema = z.object({
  nome: z.string().trim().min(2, "Dê um nome para a turma").max(200, "Nome muito longo (máx. 200)"),
});

export async function createTurma(req: Request, res: Response) {
  const { nome } = createTurmaSchema.parse(req.body);

  try {
    const turma = await prisma.turma.create({ data: { nome } });
    res.status(201).json({ id: turma.id, nome: turma.nome });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "Já existe uma turma com esse nome");
    }
    throw err;
  }
}

export async function deleteTurma(req: Request, res: Response) {
  const { id } = req.params;

  const turma = await prisma.turma.findUnique({
    where: { id },
    select: { _count: { select: { users: true } } },
  });
  if (!turma) throw new HttpError(404, "Turma não encontrada");
  if (turma._count.users > 0) {
    throw new HttpError(409, "Não dá para remover uma turma que ainda tem alunos cadastrados");
  }

  await prisma.turma.delete({ where: { id } });
  res.status(204).send();
}
