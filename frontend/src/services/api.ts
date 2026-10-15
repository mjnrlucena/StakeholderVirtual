import axios, { AxiosError } from "axios";
import type { AuthUser, Role, Turma, TurmaComEquipes, TurmaRef, UsuarioAdmin } from "@/types/auth";
import type {
  LogFilterOptions,
  LogParams,
  LogsPage,
  LogsSummary,
  SessionLog,
} from "@/types/logs";
import type { ChatResponse, ChatSession, SendMessageResponse } from "@/types/chat";
import type { AdminProject, Project, UnansweredQuestion } from "@/types/project";

/**
 * Backend Node/Express, agora um serviço separado (Render). Autenticação
 * é 100% via cookies httpOnly (accessToken/refreshToken) — por isso
 * `withCredentials: true` é obrigatório em toda chamada.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// Refresh automático: se uma chamada vier 401, tenta renovar o access
// token uma vez (via cookie de refresh) e repete a requisição original.
// Evita deslogar o usuário só porque o access token (curto, 15min) expirou.
let refreshPromise: Promise<void> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosError["config"] & { _retried?: boolean }) | undefined;
    const isAuthCall = original?.url?.includes("/auth/");

    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      try {
        refreshPromise ??= api.post("/auth/refresh").then(() => undefined);
        await refreshPromise;
        refreshPromise = null;
        return api.request(original);
      } catch {
        refreshPromise = null;
      }
    }

    return Promise.reject(error);
  },
);

// --- Auth ---------------------------------------------------------------

export interface RegisterInput {
  nome: string;
  email: string;
  password: string;
  turmaId: string;
  equipeId?: string;
}

export async function register(input: RegisterInput): Promise<AuthUser> {
  const { data } = await api.post<AuthUser>("/auth/register", input);
  return data;
}

// Pública: usada pelos selects de turma e equipe na tela de cadastro.
export async function listarTurmas(): Promise<TurmaComEquipes[]> {
  const { data } = await api.get<TurmaComEquipes[]>("/turmas");
  return data;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const { data } = await api.post<AuthUser>("/auth/login", { email, password });
  return data;
}

export async function solicitarRedefinicaoSenha(email: string): Promise<void> {
  await api.post("/auth/forgot-password", { email });
}

export async function redefinirSenha(token: string, password: string): Promise<void> {
  await api.post("/auth/reset-password", { token, password });
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
}

export async function atualizarMeuNome(nome: string): Promise<AuthUser> {
  const { data } = await api.patch<AuthUser>("/perfil", { nome });
  return data;
}

// Escolhe qual das turmas da pessoa vale nesta sessão (logs e projetos).
export async function selecionarTurma(turmaId: string): Promise<AuthUser> {
  const { data } = await api.patch<AuthUser>("/auth/turma", { turmaId });
  return data;
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>("/auth/me");
  return data;
}

// --- Projetos / Chat ------------------------------------------------------

export async function listarProjetos(): Promise<Project[]> {
  const { data } = await api.get<Project[]>("/projects");
  return data;
}

export async function listarSessoes(projectId: string): Promise<ChatSession[]> {
  const { data } = await api.get<ChatSession[]>(`/projects/${projectId}/sessions`);
  return data;
}

export async function criarSessao(projectId: string): Promise<ChatSession> {
  const { data } = await api.post<ChatSession>(`/projects/${projectId}/sessions`);
  return data;
}

/** Nome vazio volta para o padrão "Sessão N". */
export async function renomearSessao(projectId: string, chatId: string, name: string): Promise<ChatSession> {
  const { data } = await api.patch<ChatSession>(`/projects/${projectId}/sessions/${chatId}`, { name });
  return data;
}

export async function removerSessao(projectId: string, chatId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/sessions/${chatId}`);
}

export async function obterChat(projectId: string, chatId: string): Promise<ChatResponse> {
  const { data } = await api.get<ChatResponse>(`/projects/${projectId}/sessions/${chatId}`);
  return data;
}

export async function enviarPergunta(
  projectId: string,
  chatId: string,
  pergunta: string,
): Promise<SendMessageResponse> {
  const { data } = await api.post<SendMessageResponse>(`/projects/${projectId}/sessions/${chatId}/message`, {
    pergunta,
  });
  return data;
}

// --- Admin ---------------------------------------------------------------

export async function listarProjetosAdmin(): Promise<AdminProject[]> {
  const { data } = await api.get<AdminProject[]>("/admin/projects");
  return data;
}

export async function removerProjeto(id: string): Promise<void> {
  await api.delete(`/admin/projects/${id}`);
}

export async function definirTurmasDoProjeto(id: string, turmaIds: string[]): Promise<void> {
  await api.put(`/admin/projects/${id}/turmas`, { turmaIds });
}

export async function criarProjeto(params: {
  title: string;
  description?: string;
  pdf: File;
}): Promise<{ id: string; title: string }> {
  const form = new FormData();
  form.append("title", params.title);
  if (params.description) form.append("description", params.description);
  form.append("pdf", params.pdf);

  const { data } = await api.post<{ id: string; title: string }>("/admin/projects", form);
  return data;
}

export async function listarPerguntasNaoRespondidas(): Promise<UnansweredQuestion[]> {
  const { data } = await api.get<UnansweredQuestion[]>("/admin/unanswered-questions");
  return data;
}

// Responder gera contexto: a resposta é anexada ao relatório do projeto.
export async function responderPergunta(id: string, answer: string): Promise<UnansweredQuestion> {
  const { data } = await api.patch<UnansweredQuestion>(`/admin/unanswered-questions/${id}/answer`, {
    answer,
  });
  return data;
}

// Descarta a pergunta sem gerar nenhum contexto novo.
export async function contextoDaPergunta(id: string): Promise<SessionLog[]> {
  const { data } = await api.get<SessionLog[]>(`/admin/unanswered-questions/${id}/context`);
  return data;
}

export async function deletarPergunta(id: string): Promise<void> {
  await api.delete(`/admin/unanswered-questions/${id}`);
}

// --- SuperAdmin: papéis e turmas ----------------------------------------------

export async function promoverUsuario(email: string, role: Extract<Role, "PROFESSOR" | "GESTOR" | "ALUNO">) {
  const { data } = await api.post("/admin/promover", { email, role });
  return data;
}

export async function listarTurmasAdmin(): Promise<Turma[]> {
  const { data } = await api.get<Turma[]>("/admin/turmas");
  return data;
}

export async function criarTurma(nome: string): Promise<TurmaRef> {
  const { data } = await api.post<TurmaRef>("/admin/turmas", { nome });
  return data;
}

export async function removerTurma(id: string): Promise<void> {
  await api.delete(`/admin/turmas/${id}`);
}

// --- Professor: equipes e cadastros -------------------------------------------

export async function criarEquipe(turmaId: string, nome: string): Promise<TurmaRef> {
  const { data } = await api.post<TurmaRef>(`/admin/turmas/${turmaId}/equipes`, { nome });
  return data;
}

export async function renomearEquipe(id: string, nome: string): Promise<TurmaRef> {
  const { data } = await api.patch<TurmaRef>(`/admin/equipes/${id}`, { nome });
  return data;
}

export async function removerEquipe(id: string): Promise<void> {
  await api.delete(`/admin/equipes/${id}`);
}

export async function listarUsuariosAdmin(): Promise<UsuarioAdmin[]> {
  const { data } = await api.get<UsuarioAdmin[]>("/admin/usuarios");
  return data;
}

export async function alterarTurmaDoUsuario(
  id: string,
  turmaId: string | null,
  equipeId: string | null,
  outras: { turmaId: string; equipeId: string | null }[],
): Promise<void> {
  await api.patch(`/admin/usuarios/${id}`, { turmaId, equipeId, outras });
}

// --- Professor: logs das conversas ---------------------------------------------

// Tira vazios para a URL ficar limpa; arrays viram `chave[]=a&chave[]=b`.
function cleanParams(params: LogParams) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) =>
      Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "" && v !== false,
    ),
  );
}

export async function listarLogs(params: LogParams): Promise<LogsPage> {
  const { data } = await api.get<LogsPage>("/admin/logs", { params: cleanParams(params) });
  return data;
}

export async function resumoLogs(params: LogParams): Promise<LogsSummary> {
  const { data } = await api.get<LogsSummary>("/admin/logs/summary", { params: cleanParams(params) });
  return data;
}

export async function opcoesFiltroLogs(): Promise<LogFilterOptions> {
  const { data } = await api.get<LogFilterOptions>("/admin/logs/filters");
  return data;
}

export async function conversaDoLog(sessionId: string): Promise<SessionLog[]> {
  const { data } = await api.get<SessionLog[]>(`/admin/logs/sessions/${sessionId}`);
  return data;
}
