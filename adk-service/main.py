"""
Microserviço FastAPI que expõe o pipeline de agentes ADK para o backend
Node/Express chamar. Roda como um Web Service separado no Render.
"""

import os
from typing import List, Literal

from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel

load_dotenv()

from agents.pipeline import run_feedback, run_pipeline  # noqa: E402

app = FastAPI(title="StakeholderVirtual ADK Service")


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
