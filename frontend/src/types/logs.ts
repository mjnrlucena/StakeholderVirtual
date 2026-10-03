import type { Role } from "./auth";

export type LogKind = "PERGUNTA" | "FEEDBACK";

export interface LogEntry {
  id: string;
  createdAt: string;
  kind: LogKind;
  sessionId: string;
  userRole: Role;
  turmaId: string | null;
  turmaNome: string;
  projectId: string;
  projectTitle: string;
  prompt: string;
  response: string;
  grounded: boolean | null;
  coveredByReport: boolean | null;
  latencyMs: number;
  error: string | null;
}

export interface LogsPage {
  items: LogEntry[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}

export interface LogsSummary {
  total: number;
  activeUsers: number;
  questions: number;
  notCovered: number;
  ungrounded: number;
  avgLatencyMs: number;
  errors: number;
  byTurma: { turmaId: string | null; turmaNome: string; count: number }[];
  byProject: { projectId: string; projectTitle: string; count: number }[];
  byDay: { day: string; count: number }[];
}

export interface LogFilterOptions {
  turmas: { id: string; nome: string }[];
  projetos: { id: string; title: string }[];
}

export type SessionLog = Omit<
  LogEntry,
  "sessionId" | "userRole" | "turmaId" | "turmaNome" | "projectId" | "projectTitle"
>;

export type LogOrder = "recentes" | "antigas" | "relevancia";

/** Todos os filtros são opcionais e combináveis entre si. */
export interface LogParams {
  q?: string;
  prompt?: string;
  resposta?: string;
  turmas?: string[];
  projetos?: string[];
  perfis?: Role[];
  tipos?: LogKind[];
  cobertura?: "coberta" | "nao_coberta";
  fundamentacao?: "fundamentada" | "nao_fundamentada";
  somenteErros?: boolean;
  de?: string;
  ate?: string;
  ordem?: LogOrder;
  pagina?: number;
  porPagina?: number;
}
