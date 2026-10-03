"""
Microserviço FastAPI que expõe o pipeline de agentes ADK para o backend
Node/Express chamar. Roda como um Web Service separado no Render.
"""

import asyncio
import os
from contextlib import asynccontextmanager
from typing import List, Literal

from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel

load_dotenv()

from agents.pipeline import run_feedback, run_pipeline  # noqa: E402



async def _warmup() -> None:
    """Roda o pipeline uma vez com dados fictícios para pagar, no boot, o custo
    do PRIMEIRO prompt (imports preguiçosos, schemas, conexão TLS com a OpenAI).
    Custa só 2 chamadas pequenas por start; desligue com ADK_WARMUP=0."""
    try:
        await run_pipeline(
            question="Oi, tudo bem?",
            report_text="Relatório fictício usado apenas para aquecer o serviço.",
            history=[],
        )
        print("[warmup] pipeline aquecido")
    except Exception as exc:  # noqa: BLE001 - aquecimento nunca derruba o serviço
        print(f"[warmup] falhou (ignorado): {exc}")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(_warmup()) if os.getenv("ADK_WARMUP", "1") != "0" else None
    yield
    if task and not task.done():
        task.cancel()


app = FastAPI(title="StakeholderVirtual ADK Service", lifespan=lifespan)


class HistoryTurn(BaseModel):
    role: Literal["user", "stakeholder"]
    content: str


class AnswerRequest(BaseModel):
    question: str
    reportText: str
    history: List[HistoryTurn] = []


class AnswerResponse(BaseModel):
    answer: str
    grounded: bool
    coveredByReport: bool


class FeedbackRequest(BaseModel):
    history: List[HistoryTurn]


class FeedbackResponse(BaseModel):
    feedback: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/answer", response_model=AnswerResponse)
async def answer(payload: AnswerRequest):
    result = await run_pipeline(
        question=payload.question,
        report_text=payload.reportText,
        history=[turn.model_dump() for turn in payload.history],
    )
    return result


@app.post("/feedback", response_model=FeedbackResponse)
async def feedback(payload: FeedbackRequest):
    text = await run_feedback(history=[turn.model_dump() for turn in payload.history])
    return {"feedback": text}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)
