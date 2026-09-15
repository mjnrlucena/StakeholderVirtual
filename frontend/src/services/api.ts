import axios from "axios";
import type { PerguntaResponse } from "@/types/chat";

/**
 * Em desenvolvimento, o Vite faz proxy de "/pergunta" para o Flask local
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
 * Caminho do endpoint de pergunta. Os dois deploys usam o mesmo
 * chatbot.py/process_pdf.py, só o "endereço" muda:
 * - Deploy no Render (main.py, Flask servindo tudo): "/pergunta" (padrão)
 * - Deploy na Vercel (função Python em api/pergunta.py): "/api/pergunta"
 *   — configurado via variável de ambiente VITE_API_ENDPOINT no projeto
 *   da Vercel (Project Settings > Environment Variables).
 */
const ENDPOINT = import.meta.env.VITE_API_ENDPOINT || "/pergunta";

/**
 * Envia uma pergunta ao stakeholder virtual.
 */
export async function enviarPergunta(
  pergunta: string,
): Promise<PerguntaResponse> {
  const body = new URLSearchParams({ pergunta });
  const { data } = await api.post<PerguntaResponse>(ENDPOINT, body);
  return data;
}

/**
 * Encerra a entrevista e pede o feedback pedagógico.
 * O backend usa a palavra "sair" como gatilho para essa análise.
 */
export async function solicitarFeedback(): Promise<PerguntaResponse> {
  const body = new URLSearchParams({ pergunta: "sair" });
  const { data } = await api.post<PerguntaResponse>(ENDPOINT, body);
  return data;
}
