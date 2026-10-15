import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/errorHandler";

// Include para ler turma/equipe ativas + matrículas de uma pessoa.
export const comVinculos = {
  turma: true,
  equipe: true,
  matriculas: { include: { turma: true, equipe: true } },
} satisfies Prisma.UserInclude;

type Ref = { id: string; nome: string };
type Vinculo = { turma: Ref & { createdAt: Date }; equipe: Ref | null };

// Turmas da pessoa com a equipe em cada uma: a ativa + as matrículas (contas
// antigas só têm a ativa). A ativa vale sobre a matrícula da mesma turma.
// Ordem de criação das turmas, como no resto do app.
export function vinculosDoUsuario(u: { turma: Vinculo["turma"] | null; equipe: Ref | null; matriculas: Vinculo[] }) {
  const todos = new Map<string, Vinculo>();
  for (const m of u.matriculas) todos.set(m.turma.id, m);
  if (u.turma) todos.set(u.turma.id, { turma: u.turma, equipe: u.equipe });
  return [...todos.values()]
    .sort((a, b) => a.turma.createdAt.getTime() - b.turma.createdAt.getTime())
    .map((v) => ({
      turma: { id: v.turma.id, nome: v.turma.nome },
      equipe: v.equipe && { id: v.equipe.id, nome: v.equipe.nome },
    }));
}

export const turmasDoUsuario = (u: Parameters<typeof vinculosDoUsuario>[0]) =>
  vinculosDoUsuario(u).map((v) => v.turma);

// Quem está na turma, como ativa ou por matrícula.
const membrosDaTurma = (id: string) => ({ OR: [{ turmaId: id }, { matriculas: { some: { turmaId: id } } }] });

// Lista enxuta para os selects do cadastro (sem contagens nem dados de usuários).
export async function listPublicTurmas(_req: Request, res: Response) {
  const turmas = await prisma.turma.findMany({
    select: { id: true, nome: true, equipes: { select: { id: true, nome: true }, orderBy: { nome: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(turmas);
}

// --- Gerenciamento (listar: professor; criar/remover turma: superadmin) -----

export async function listTurmasAdmin(_req: Request, res: Response) {
  const turmas = await prisma.turma.findMany({
    select: {
      id: true,
      nome: true,
      createdAt: true,
      equipes: {
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  // Conta pessoas distintas por turma/equipe, somando a ativa e as matrículas.
  // ponytail: lê todos os usuários; trocar por GROUP BY em SQL se passar de alguns milhares.
  const users = await prisma.user.findMany({
    select: { id: true, turmaId: true, equipeId: true, matriculas: { select: { turmaId: true, equipeId: true } } },
  });
  const membros = new Map<string, Set<string>>();
  const add = (key: string | null, userId: string) => {
    if (key) membros.set(key, (membros.get(key) ?? new Set<string>()).add(userId));
  };
  for (const u of users) {
    for (const v of [{ turmaId: u.turmaId, equipeId: u.equipeId }, ...u.matriculas]) {
      add(v.turmaId, u.id);
      add(v.equipeId, u.id);
    }
  }
  const alunos = (id: string) => membros.get(id)?.size ?? 0;

  res.json(
    turmas.map((t) => ({
      id: t.id,
      nome: t.nome,
      createdAt: t.createdAt,
      alunos: alunos(t.id),
      equipes: t.equipes.map((e) => ({ id: e.id, nome: e.nome, alunos: alunos(e.id) })),
    })),
  );
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

  const turma = await prisma.turma.findUnique({ where: { id }, select: { id: true } });
  if (!turma) throw new HttpError(404, "Turma não encontrada");
  if ((await prisma.user.count({ where: membrosDaTurma(id) })) > 0) {
    throw new HttpError(409, "Não dá para remover uma turma que ainda tem alunos cadastrados");
  }

  await prisma.turma.delete({ where: { id } });
  res.status(204).send();
}

// --- Equipes (professor / superadmin) -----------------------------------------

const equipeSchema = z.object({
  nome: z.string().trim().min(1, "Dê um nome para a equipe").max(120, "Nome muito longo (máx. 120)"),
});

function uniqueEquipeError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    throw new HttpError(409, "Já existe uma equipe com esse nome nessa turma");
  }
  throw err;
}

export async function createEquipe(req: Request, res: Response) {
  const { nome } = equipeSchema.parse(req.body);
  const turma = await prisma.turma.findUnique({ where: { id: req.params.turmaId }, select: { id: true } });
  if (!turma) throw new HttpError(404, "Turma não encontrada");

  const equipe = await prisma.equipe.create({ data: { nome, turmaId: turma.id } }).catch(uniqueEquipeError);
  res.status(201).json({ id: equipe.id, nome: equipe.nome });
}

export async function renameEquipe(req: Request, res: Response) {
  const { nome } = equipeSchema.parse(req.body);
  const equipe = await prisma.equipe
    .update({ where: { id: req.params.id }, data: { nome } })
    .catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new HttpError(404, "Equipe não encontrada");
      }
      uniqueEquipeError(err);
    });
  res.json({ id: equipe.id, nome: equipe.nome });
}

// Os membros continuam na turma, só ficam sem equipe (onDelete: SetNull).
export async function deleteEquipe(req: Request, res: Response) {
  const { count } = await prisma.equipe.deleteMany({ where: { id: req.params.id } });
  if (count === 0) throw new HttpError(404, "Equipe não encontrada");
  res.status(204).send();
}

// --- Cadastros: turma e equipe de cada usuário (professor / superadmin) -----

export async function listUsersAdmin(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      createdAt: true,
      turmaId: true,
      ...comVinculos,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    users.map((u) => {
      const vinculos = vinculosDoUsuario(u);
      return {
        id: u.id,
        nome: u.nome,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        turma: u.turma && { id: u.turma.id, nome: u.turma.nome },
        equipe: u.equipe && { id: u.equipe.id, nome: u.equipe.nome },
        turmas: vinculos.map((v) => v.turma),
        // As outras turmas (fora a ativa), cada uma com a sua equipe.
        outras: vinculos.filter((v) => v.turma.id !== u.turmaId),
      };
    }),
  );
}

const updateUserSchema = z.object({
  turmaId: z.string().min(1).nullable(),
  equipeId: z.string().min(1).nullable(),
  // Outras turmas da pessoa, cada uma com a sua equipe. Sem turmaId, fica sem nenhuma.
  outras: z.array(z.object({ turmaId: z.string().min(1), equipeId: z.string().min(1).nullable() })).default([]),
});

export async function updateUserTurma(req: Request, res: Response) {
  const { turmaId, equipeId, outras } = updateUserSchema.parse(req.body);
  const vinculos = turmaId ? [{ turmaId, equipeId }, ...outras] : [];

  const turmaIds = vinculos.map((v) => v.turmaId);
  if (new Set(turmaIds).size !== turmaIds.length) throw new HttpError(400, "A mesma turma aparece mais de uma vez");
  if ((await prisma.turma.count({ where: { id: { in: turmaIds } } })) !== turmaIds.length) {
    throw new HttpError(400, "Turma inválida");
  }
  const equipeIds = vinculos.flatMap((v) => (v.equipeId ? [v.equipeId] : []));
  const equipes = await prisma.equipe.findMany({ where: { id: { in: equipeIds } }, select: { id: true, turmaId: true } });
  for (const v of vinculos) {
    if (v.equipeId && equipes.find((e) => e.id === v.equipeId)?.turmaId !== v.turmaId) {
      throw new HttpError(400, "A equipe precisa ser da turma escolhida");
    }
  }

  const userId = req.params.id;
  if (!(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    throw new HttpError(404, "Usuário não encontrado");
  }
  // A ativa também vira matrícula, para não se perder quando a pessoa trocar de turma.
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { turmaId, equipeId: turmaId ? equipeId : null } }),
    prisma.matricula.deleteMany({ where: { userId } }),
    prisma.matricula.createMany({ data: vinculos.map((v) => ({ userId, ...v })) }),
  ]);
  res.json({ id: userId });
}
