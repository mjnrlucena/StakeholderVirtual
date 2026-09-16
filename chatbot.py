import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# Configuração da API Key
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def gerar_resposta(pergunta, contexto):
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
    {
        "role": "system",
        "content": (
            "Você é um stakeholder virtual que representa um cliente real. "
            "Você participou de reuniões sobre um novo sistema e tem informações gerais sobre ele, "
            "mas não fala como um documento técnico. "
            "Responda de forma natural, curta e conversacional, como se estivesse em uma entrevista. "
            "Não liste funcionalidades de forma organizada ou numerada. "
            "Evite linguagem técnica ou estruturada como em um documento de requisitos. "
            "Se o estudante sugerir algo plausível, aceite ou complemente de forma natural. "
            "Você pode omitir detalhes ou estar incerto em alguns pontos, mas não deve parecer inseguro demais. "
            "Não revele imediatamente todos os detalhes — deixe o estudante investigar aos poucos. "
        ),
    },
    {
        "role": "system",
        "content": f"Informações de apoio do sistema (não leia como lista, use apenas como pano de fundo): {contexto}"
    },
    {"role": "user", "content": pergunta},
    ],
        temperature=0.3,  # Controla a criatividade - para manter respostas realistas, sem muita aleatoriedade
    )
    return response.choices[0].message.content.strip()


def gerar_feedback(conversa):
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "Você é um avaliador pedagógico especializado em entrevistas de Engenharia de Requisitos. "
                    "Sua tarefa é analisar a conversa entre o estudante e o stakeholder virtual "
                    "e dar um feedback claro, estruturado e construtivo. "
                    "Sempre siga esta estrutura no feedback:\n\n"
                    "1. **Pontos fortes** – destaque boas práticas do estudante.\n"
                    "2. **Pontos a melhorar** – identifique falhas ou oportunidades.\n"
                    "3. **Recomendações práticas** – dicas específicas e aplicáveis de como melhorar.\n"
                    "4. **Avaliação geral** – uma breve conclusão motivadora sobre o desempenho.\n\n"
                    "Se possível, use exemplos concretos das perguntas feitas para deixar o feedback mais útil. "
                    "O tom deve ser construtivo, realista e encorajador, como um professor ajudando um aluno."
                ),
            },
            {"role": "user", "content": f"Aqui está a transcrição da conversa: {conversa}"},
        ],
        temperature=0.4,
    )
    return response.choices[0].message.content.strip()



if __name__ == "__main__":
    # Teste simples
    contexto = "O sistema deve permitir compras online de ingressos."
    pergunta = "Quais são os principais atores do sistema?"
    resposta = gerar_resposta(pergunta, contexto)
    print("Resposta do chatbot:", resposta)
