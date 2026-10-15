import { Request, Response } from "express";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/errorHandler";
import { warmAdk } from "../services/adkClient.service";

// Professor e superadmin veem (e testam) todos os projetos; aluno e gestor só
// os liberados para a turma deles — sem turma marcada, ninguém além deles vê.
async function visibleProjectsWhere(user: { id: string; role: Role }): Promise<Prisma.ProjectWhereInput> {
  if (user.role === Role.PROFESSOR || user.role === Role.SUPERADMIN) return {};
  const { turmaId } = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { turmaId: true } });
  return turmaId ? { turmas: { some: { id: turmaId } } } : { id: { in: [] } };
}

export async function findVisibleProject(user: { id: string; role: Role }, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...(await visibleProjectsWhere(user)) },
  });
  if (!project) throw new HttpError(404, "Projeto não encontrado");
  return project;
}

export async function listProjects(req: Request, res: Response) {
  warmAdk();
  const projects = await prisma.project.findMany({
    where: await visibleProjectsWhere(req.user!),
    select: { id: true, title: true, description: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(projects);
}
