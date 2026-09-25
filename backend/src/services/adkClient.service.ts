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
