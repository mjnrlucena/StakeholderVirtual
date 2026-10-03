export type Role = "ALUNO" | "PROFESSOR" | "GESTOR" | "SUPERADMIN";

export interface TurmaRef {
  id: string;
  nome: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  /** Turma do aluno (equipe pode não ter). */
  turma: TurmaRef | null;
}

export interface Turma extends TurmaRef {
  createdAt: string;
  /** Quantidade de alunos cadastrados na turma. */
  alunos: number;
}
