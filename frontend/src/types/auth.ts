export type Role = "ALUNO" | "PROFESSOR" | "GESTOR" | "SUPERADMIN";

export interface TurmaRef {
  id: string;
  nome: string;
}

/** Turma com as equipes, para os selects do cadastro. */
export interface TurmaComEquipes extends TurmaRef {
  equipes: TurmaRef[];
}

export interface AuthUser {
  id: string;
  email: string;
  nome: string | null;
  role: Role;
  /** Turma ativa: a escolhida no login, usada nos logs e nos projetos. */
  turma: TurmaRef | null;
  /** Todas as turmas da pessoa (inclui a ativa), em ordem de criação. */
  turmas: TurmaRef[];
}

export interface Turma extends TurmaRef {
  createdAt: string;
  /** Quantidade de alunos cadastrados na turma. */
  alunos: number;
  equipes: (TurmaRef & { alunos: number })[];
}

/** Linha da página de cadastros (turma/equipe de cada usuário). */
export interface UsuarioAdmin {
  id: string;
  nome: string | null;
  email: string;
  role: Role;
  createdAt: string;
  turma: TurmaRef | null;
  equipe: TurmaRef | null;
  /** Todas as turmas da pessoa (inclui a ativa). */
  turmas: TurmaRef[];
  /** As outras turmas (fora a ativa), cada uma com a sua equipe. */
  outras: Vinculo[];
}

/** Uma turma da pessoa e a equipe dela nessa turma. */
export interface Vinculo {
  turma: TurmaRef;
  equipe: TurmaRef | null;
}
