import { env } from "../env";

export interface AdkHistoryTurn {
  role: "user" | "stakeholder";
  content: string;
}

export interface AdkAnswerResponse {
  answer: string;
  grounded: boolean;
  coveredByReport: boolean;
}

// Chama o microserviço Python que roda o pipeline de agentes do ADK
// (persona do stakeholder + verificador de fundamentação).
export async function askAdkAgent(params: {
  question: string;
  reportText: string;
  history: AdkHistoryTurn[];
}): Promise<AdkAnswerResponse> {
  const response = await fetch(`${env.adkServiceUrl}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Microserviço ADK retornou ${response.status}: ${text}`);
  }

  return (await response.json()) as AdkAnswerResponse;
}

// Chama o agente de feedback pedagógico (avaliação da entrevista até agora).
export async function askAdkFeedback(history: AdkHistoryTurn[]): Promise<string> {
  const response = await fetch(`${env.adkServiceUrl}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Microserviço ADK retornou ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { feedback: string };
  return data.feedback;
}

// Acorda o microserviço ADK (Render free dorme após inatividade e o cold start
// leva dezenas de segundos). Chamado quando o aluno abre a lista de projetos
// ou um chat, para o serviço já estar de pé quando ele mandar o primeiro
// prompt. Fire-and-forget, com no máximo uma chamada a cada 4 minutos.
let lastWarmAt = 0;

export function warmAdk(): void {
  const now = Date.now();
  if (now - lastWarmAt < 4 * 60 * 1000) return;
  lastWarmAt = now;

  fetch(`${env.adkServiceUrl}/health`, { signal: AbortSignal.timeout(90_000) }).catch(() => {
    // Sem problema: é só um aquecimento.
  });
}
