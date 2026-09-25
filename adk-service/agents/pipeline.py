"""
Pipeline de 2 agentes (Google ADK) para o StakeholderVirtual:

1. `stakeholder_persona`  — responde como o stakeholder, no tom natural e
   "evasivo" de uma entrevista real, mas restrito ao relatório fornecido.
2. `fidelity_verifier`    — recebe a resposta rascunho do primeiro agente e
   decide se ela é sustentada pelo relatório. Se não for, força uma
   resposta de "não sei" em vez de deixar a invenção passar.

O serviço é *stateless* por design: cada chamada recebe o relatório e o
histórico inteiros vindos do backend Node (que é quem persiste tudo no
Postgres) e cria uma sessão do ADK só para essa execução, descartada logo
depois. Isso evita depender de estado em memória do processo Python, que
se perderia a cada redeploy/restart no Render.
"""

import os
import uuid
from typing import Any, Dict, List

from pydantic import BaseModel
from google.adk.agents.llm_agent import LlmAgent
from google.adk.agents.sequential_agent import SequentialAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.runners import InMemoryRunner
from google.genai import types

APP_NAME = "stakeholder-virtual"
MODEL_NAME = os.getenv("ADK_MODEL", "openai/gpt-4o-mini")  # LiteLLM -> usa OPENAI_API_KEY

PERSONA_INSTRUCTION = """
Você é um stakeholder virtual que representa um cliente real em uma entrevista de
levantamento de requisitos de Engenharia de Software. Você participou das reuniões
sobre o sistema descrito no relatório abaixo e tem informações gerais sobre ele,
mas não fala como um documento técnico.

Regras de estilo:
- Responda de forma natural, curta e conversacional, como em uma entrevista real.
- Não liste funcionalidades de forma organizada ou numerada.
- Evite linguagem técnica ou estruturada de documento de requisitos.
- Não revele todos os detalhes de uma vez — deixe o estudante investigar aos poucos.
- Se o estudante sugerir algo plausível e coerente com o relatório, aceite ou
  complemente de forma natural.

Regra inegociável: use SOMENTE as informações do RELATÓRIO e do HISTÓRICO abaixo.
Se a pergunta pedir algo que não está no relatório, diga com naturalidade que não
tem certeza / que isso não foi discutido nas reuniões — nunca invente um detalhe
que não esteja no relatório.

RELATÓRIO DE APOIO (use como pano de fundo, não cite como lista):
{report_text}

HISTÓRICO DA CONVERSA ATÉ AGORA:
{history}

PERGUNTA ATUAL DO ESTUDANTE:
{question}

Responda apenas com a fala do stakeholder, sem nenhum comentário fora do personagem.
""".strip()

VERIFIER_INSTRUCTION = """
Você é um verificador de fidelidade factual. Sua tarefa tem duas partes:

1. Decidir se as afirmações feitas na RESPOSTA RASCUNHO são sustentadas pelo
   RELATÓRIO (ou são inferências razoáveis e conservadoras a partir dele) ou
   se contêm invenção/alucinação — isso vai no campo `grounded`.
2. Decidir, independente do que o rascunho disse, se o RELATÓRIO contém
   informação suficiente para responder à pergunta do estudante — isso vai
   no campo `covered_by_report`. Uma resposta honesta tipo "não sei, não
   foi discutido" É fiel (`grounded=true`), mas normalmente significa que o
   relatório NÃO cobre o assunto (`covered_by_report=false`) — são coisas
   diferentes, avalie as duas separadamente.

RELATÓRIO:
{report_text}

PERGUNTA DO ESTUDANTE:
{question}

RESPOSTA RASCUNHO DO STAKEHOLDER:
{draft_answer}

Se a resposta rascunho for fiel ao relatório: `grounded=true` e repita a
resposta rascunho (ou uma versão levemente polida, sem mudar o conteúdo) em
`final_answer`.

Se a resposta rascunho inventar algo que não está no relatório: `grounded=false`
e, em `final_answer`, escreva uma resposta curta e natural do stakeholder
dizendo que não tem certeza sobre esse ponto específico / que isso não foi
definido nas reuniões — mantendo o tom de personagem, não de sistema.

Em `covered_by_report`, responda `false` sempre que o relatório não tiver
informação pra essa pergunta específica (mesmo que a resposta tenha sido
honesta), e `true` quando o relatório realmente cobre o assunto perguntado.
""".strip()

FEEDBACK_INSTRUCTION = """
Você é um avaliador pedagógico especializado em entrevistas de Engenharia de
Requisitos. Sua tarefa é analisar a conversa entre o estudante e o
stakeholder virtual e dar um feedback claro, estruturado e construtivo.

Sempre siga esta estrutura no feedback:

1. **Pontos fortes** – destaque boas práticas do estudante.
2. **Pontos a melhorar** – identifique falhas ou oportunidades.
3. **Recomendações práticas** – dicas específicas e aplicáveis de como melhorar.
4. **Avaliação geral** – uma breve conclusão motivadora sobre o desempenho.

Se possível, use exemplos concretos das perguntas feitas para deixar o
feedback mais útil. O tom deve ser construtivo, realista e encorajador, como
um professor ajudando um aluno.

TRANSCRIÇÃO DA CONVERSA:
{history}
""".strip()


class VerificationResult(BaseModel):
    grounded: bool
    covered_by_report: bool
    final_answer: str


def _build_pipeline() -> SequentialAgent:
    persona_agent = LlmAgent(
        name="stakeholder_persona",
        model=LiteLlm(model=MODEL_NAME),
        instruction=PERSONA_INSTRUCTION,
        output_key="draft_answer",
    )
    verifier_agent = LlmAgent(
        name="fidelity_verifier",
        model=LiteLlm(model=MODEL_NAME),
        instruction=VERIFIER_INSTRUCTION,
        output_schema=VerificationResult,
        output_key="verification",
    )
    return SequentialAgent(name="stakeholder_pipeline", sub_agents=[persona_agent, verifier_agent])


def _format_history(history: List[Dict[str, str]]) -> str:
    if not history:
        return "(sem histórico ainda, é a primeira pergunta desta conversa)"
    linhas = []
    for turn in history:
        quem = "Aluno" if turn["role"] == "user" else "Stakeholder"
        linhas.append(f"{quem}: {turn['content']}")
    return "\n".join(linhas)


async def run_pipeline(question: str, report_text: str, history: List[Dict[str, str]]) -> Dict[str, Any]:
    pipeline = _build_pipeline()
    runner = InMemoryRunner(agent=pipeline, app_name=APP_NAME)

    user_id = "adhoc-user"
    session_id = str(uuid.uuid4())

    await runner.session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
        state={
            "report_text": report_text,
            "history": _format_history(history),
            "question": question,
        },
    )

    new_message = types.Content(role="user", parts=[types.Part(text=question)])

    async for _event in runner.run_async(
        user_id=user_id, session_id=session_id, new_message=new_message
    ):
        pass  # só precisamos do estado final, não dos eventos intermediários

    session = await runner.session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )

    verification = session.state.get("verification")
    draft_answer = session.state.get("draft_answer", "")

    if isinstance(verification, VerificationResult):
        grounded = verification.grounded
        covered_by_report = verification.covered_by_report
        final_answer = verification.final_answer
    elif isinstance(verification, dict):
        grounded = bool(verification.get("grounded", False))
        covered_by_report = bool(verification.get("covered_by_report", False))
        final_answer = verification.get("final_answer") or draft_answer
    else:
        # Defensivo: se o verificador não produziu um resultado utilizável,
        # não arriscamos alucinação — tratamos como não coberto pelo relatório.
        grounded = False
        covered_by_report = False
        final_answer = (
            "Isso eu não sei te dizer com certeza, não é algo que ficou "
            "claro nas reuniões que participei."
        )

    return {"answer": final_answer, "grounded": grounded, "coveredByReport": covered_by_report}


def _build_feedback_agent() -> LlmAgent:
    return LlmAgent(
        name="interview_feedback",
        model=LiteLlm(model=MODEL_NAME),
        instruction=FEEDBACK_INSTRUCTION,
        output_key="feedback",
    )


async def run_feedback(history: List[Dict[str, str]]) -> str:
    """Gera a avaliação pedagógica da entrevista inteira até agora."""
    agent = _build_feedback_agent()
    runner = InMemoryRunner(agent=agent, app_name=APP_NAME)

    user_id = "adhoc-user"
    session_id = str(uuid.uuid4())

    await runner.session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
        state={"history": _format_history(history)},
    )

    new_message = types.Content(
        role="user", parts=[types.Part(text="Avalie a entrevista até agora.")]
    )

    async for _event in runner.run_async(
        user_id=user_id, session_id=session_id, new_message=new_message
    ):
        pass

    session = await runner.session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )

    return session.state.get("feedback") or (
        "Não foi possível gerar o feedback agora. Tente novamente em instantes."
    )
