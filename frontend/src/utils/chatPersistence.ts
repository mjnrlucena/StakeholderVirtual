import type { ChatMessage } from "@/types/chat";

const STORAGE_KEY = "stakeholder-virtual:chat";

/** Tempo máximo de inatividade antes do chat ser descartado. */
export const EXPIRATION_MS = 30 * 60 * 1000; // 30 minutos

interface StoredChat {
  messages: ChatMessage[];
  lastActivity: number; // epoch ms
}

/**
 * Lê o chat salvo no localStorage.
 * Se a última atividade foi há mais de 30 minutos, descarta e retorna vazio.
 */
export function loadChat(): ChatMessage[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as StoredChat;
    const expirado = Date.now() - parsed.lastActivity > EXPIRATION_MS;
    if (expirado) {
      clearChat();
      return [];
    }
    return parsed.messages ?? [];
  } catch {
    // JSON corrompido/formato antigo: começa do zero.
    clearChat();
    return [];
  }
}

/** Salva o chat e atualiza o timestamp de última atividade. */
export function saveChat(messages: ChatMessage[]): void {
  const payload: StoredChat = { messages, lastActivity: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

/** Só atualiza o timestamp de atividade, sem mudar as mensagens salvas. */
export function touchActivity(): void {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as StoredChat;
    parsed.lastActivity = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignora formato inválido
  }
}

/** Verifica se o chat salvo expirou, sem carregar as mensagens. */
export function isExpired(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as StoredChat;
    return Date.now() - parsed.lastActivity > EXPIRATION_MS;
  } catch {
    return true;
  }
}

export function clearChat(): void {
  localStorage.removeItem(STORAGE_KEY);
}
