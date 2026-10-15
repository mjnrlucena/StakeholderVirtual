export type MessageRole = "USER" | "STAKEHOLDER" | "FEEDBACK";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  grounded: boolean | null;
  createdAt: string;
}

export interface ChatResponse {
  chatId: string;
  messages: ChatMessage[];
}

export interface SendMessageResponse {
  resposta: string;
  grounded: boolean | null;
  dataHora: string;
}

export interface ChatSession {
  id: string;
  number: number;
  name: string | null;
  createdAt: string;
}

export function sessionLabel(s: Pick<ChatSession, "number" | "name">): string {
  return s.name ?? `Sessão ${s.number}`;
}
