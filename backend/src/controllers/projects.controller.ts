import { Request, Response } from "express";
import { prisma } from "../prisma";

export async function listProjects(_req: Request, res: Response) {
  const projects = await prisma.project.findMany({
    select: { id: true, title: true, description: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(projects);
}
