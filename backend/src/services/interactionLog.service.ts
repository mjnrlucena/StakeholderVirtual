import { LogKind, Role } from "@prisma/client";
import { prisma } from "../prisma";

export interface LogActor {
  userId: string;
  userRole: Role;
  turmaId: string | null;
  turmaNome: string;
}

// Snapshot de quem está perguntando no momento da pergunta. O log guarda
// uma cópia (e não uma relação) para continuar correto se o aluno trocar
// de turma ou se algo for removido depois. Nunca guarda o e-mail.
export async function getLogActor(userId: string): Promise<LogActor> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, role: true, turma: { select: { id: true, nome: true } } },
  });

  return {
    userId: user.id,
    userRole: user.role,
    turmaId: user.turma?.id ?? null,
    turmaNome: user.turma?.nome ?? "Sem turma",
  };
}

export interface InteractionInput {
  actor: LogActor;
  kind: LogKind;
  sessionId: string;
  projectId: string;
  projectTitle: string;
  prompt: string;
  response: string;
  grounded: boolean | null;
  coveredByReport: boolean | null;
  latencyMs: number;
  error?: string | null;
}

// Registrar o log nunca pode derrubar o chat: se der erro, só avisa no console.
export async function recordInteraction(input: InteractionInput): Promise<void> {
  const { actor, ...rest } = input;
  try {
    await prisma.interactionLog.create({
      data: {
        ...rest,
        userId: actor.userId,
        userRole: actor.userRole,
        turmaId: actor.turmaId,
        turmaNome: actor.turmaNome,
        error: rest.error ?? null,
      },
    });
  } catch (err) {
    console.error("[interaction-log] falha ao registrar interação:", err);
  }
}
