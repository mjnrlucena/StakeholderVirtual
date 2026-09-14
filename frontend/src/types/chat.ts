export type MessageRole = "user" | "assistant" | "feedback";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  dataHora: string;
}

export interface PerguntaResponse {
  resposta: string;
  data_hora: string;
}
