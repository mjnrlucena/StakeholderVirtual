export interface Project {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
}

export interface AdminProject extends Project {
  pdfPath: string;
  /** Turmas que podem ver o projeto. */
  turmaIds: string[];
}

export interface UnansweredQuestion {
  id: string;
  question: string;
  /** Sessão do chat em que a pergunta apareceu; null nas perguntas antigas. */
  sessionId: string | null;
  answer: string | null;
  createdAt: string;
  answeredAt: string | null;
  reviewed: boolean;
  project: { id: string; title: string };
  user: { id: string; turma: { id: string; nome: string } | null } | null;
}
