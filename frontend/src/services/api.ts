import axios from "axios";
import type { PerguntaResponse } from "@/types/chat";

/**
 * Em desenvolvimento, o Vite faz proxy de "/api/pergunta" para o Flask local
 * (ver vite.config.ts), então baseURL pode ficar vazia.
 * Em produção, o próprio backend serve o build do front e responde nessa
 * mesma origem — também não precisa de baseURL.
 *
 * IMPORTANTE: nenhuma chave de API (OPENAI_API_KEY) circula por aqui.
 * A chamada real à OpenAI acontece só no backend (chatbot.py).
 */
export const api = axios.create({
  baseURL: "",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
});

/**
 * Envia uma pergunta ao stakeholder virtual.
 */
export async function enviarPergunta(
  pergunta: string,
): Promise<PerguntaResponse> {
  const body = new URLSearchParams({ pergunta });
  const { data } = await api.post<PerguntaResponse>("/api/pergunta", body);
  return data;
}

/**
 * Encerra a entrevista e pede o feedback pedagógico.
 * O backend usa a palavra "sair" como gatilho para essa análise.
 */
export async function solicitarFeedback(): Promise<PerguntaResponse> {
  const body = new URLSearchParams({ pergunta: "sair" });
  const { data } = await api.post<PerguntaResponse>("/api/pergunta", body);
  return data;
}

export async function iniciarNovaConversa(): Promise<void> {
  await api.post("/api/nova-conversa");
}