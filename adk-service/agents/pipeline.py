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

import json
import os
import uuid
from typing import Any, Dict, List

# O LiteLLM baixa um JSON de preços do GitHub ao ser importado, o que atrasa o
# boot e pode travar sem rede. Usar o mapa embutido na lib evita isso. Precisa
# ser definido ANTES de importar google.adk / litellm.
os.environ.setdefault("LITELLM_LOCAL_MODEL_COST_MAP", "True")

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

Se a resposta rascunho for fiel ao relatório: `grounded=true` e deixe
`final_answer` como string vazia ("") — a resposta rascunho será usada como
está, NÃO a repita.

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
    # Só preenchido quando grounded=False (resposta substituída). Quando o
    # rascunho é fiel fica vazio, e o modelo não gasta tokens repetindo-o.
    final_answer: str = ""


# ==============================================================================
# OTIMIZAÇÃO DE MEMÓRIA E CPU:
# Declaração das instâncias globais dos agentes e pipelines.
# Evita recriar objetos complexos do ADK/LiteLLM a cada requisição HTTP,
# economizando ciclos de processamento e mantendo o consumo de RAM estável.
# ==============================================================================

_llm_model = LiteLlm(model=MODEL_NAME)

_persona_agent = LlmAgent(
    name="stakeholder_persona",
    model=_llm_model,
    instruction=PERSONA_INSTRUCTION,
    output_key="draft_answer",
)

_verifier_agent = LlmAgent(
    name="fidelity_verifier",
    model=_llm_model,
    instruction=VERIFIER_INSTRUCTION,
    output_schema=VerificationResult,
    output_key="verification",
)

# Pipeline reutilizável contendo a sequência dos dois agentes
STAKEHOLDER_PIPELINE = SequentialAgent(
    name="stakeholder_pipeline",
    sub_agents=[_persona_agent, _verifier_agent],
)

# Agente reutilizável para a geração do feedback pedagógico
FEEDBACK_AGENT = LlmAgent(
    name="interview_feedback",
    model=_llm_model,
    instruction=FEEDBACK_INSTRUCTION,
    output_key="feedback",
)


# Runners reutilizados entre requisições (criar um por chamada é trabalho
# desperdiçado). Cada execução continua usando uma sessão própria, apagada ao fim.
_PIPELINE_RUNNER = InMemoryRunner(agent=STAKEHOLDER_PIPELINE, app_name=APP_NAME)
_FEEDBACK_RUNNER = InMemoryRunner(agent=FEEDBACK_AGENT, app_name=APP_NAME)


def _format_history(history: List[Dict[str, str]]) -> str:
    """Formata a lista de mensagens recebida em uma transcrição legível."""
    if not history:
        return "(sem histórico ainda, é a primeira pergunta desta conversa)"
    linhas = []
    for turn in history:
        # Usa .get() para prevenir KeyError caso a chave mude pontualmente
        quem = "Aluno" if turn.get("role") == "user" else "Stakeholder"
        linhas.append(f"{quem}: {turn.get('content', '')}")
    return "\n".join(linhas)


async def run_pipeline(question: str, report_text: str, history: List[Dict[str, str]]) -> Dict[str, Any]:
    runner = _PIPELINE_RUNNER

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
        pass  # Só precisamos do estado final da sessão

    session = await runner.session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )

    verification = session.state.get("verification")
    draft_answer = session.state.get("draft_answer", "")

    # ==========================================================================
    # PARSING RESILIENTE DO OUTPUT SCHEMA:
    # O LiteLLM/ADK pode serializar o schema de saída como uma string JSON pura.
    # Fazemos o parse defensivo antes de validar o tipo do objeto.
    # ==========================================================================
    if isinstance(verification, str):
        try:
            verification = json.loads(verification)
        except Exception:
            verification = None

    if isinstance(verification, VerificationResult):
        grounded = verification.grounded
        covered_by_report = verification.covered_by_report
        final_answer = verification.final_answer if not grounded else ""
        final_answer = final_answer or draft_answer
    elif isinstance(verification, dict):
        grounded = bool(verification.get("grounded", False))
        covered_by_report = bool(verification.get("covered_by_report", False))
        final_answer = (verification.get("final_answer") if not grounded else "") or draft_answer
    else:
        # Defensivo: se o verificador não produziu um resultado utilizável,
        # não arriscamos alucinação — tratamos como não coberto pelo relatório.
        grounded = False
        covered_by_report = False
        final_answer = (
            "Isso eu não sei te dizer com certeza, não é algo que ficou "
            "claro nas reuniões que participei."
        )

    # ==========================================================================
    # LIMPEZA DE MEMÓRIA (Anti-OOM):
    # Deleta a sessão explicitamente do InMemoryRunner para evitar acúmulo
    # de dicionários no heap do Python durante execuções prolongadas.
    # ==========================================================================
    await runner.session_service.delete_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )

    return {
        "answer": final_answer,
        "grounded": grounded,
        "coveredByReport": covered_by_report,
    }


async def run_feedback(history: List[Dict[str, str]]) -> str:
    """Gera a avaliação pedagógica da entrevista inteira até agora."""
    runner = _FEEDBACK_RUNNER

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

    feedback = session.state.get("feedback") or (
        "Não foi possível gerar o feedback agora. Tente novamente em instantes."
    )

    # Limpeza explícita da sessão da memória
    await runner.session_service.delete_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )

    return feedback