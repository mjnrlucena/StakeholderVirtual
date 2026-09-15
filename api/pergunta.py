"""
Função serverless da Vercel para o endpoint /api/pergunta.

Mesma lógica de sessão do main.py original: a sessão do Flask é um
cookie assinado no navegador (não fica em memória no servidor), então
funciona normalmente entre chamadas de uma função serverless.
"""

import random
import sys
from datetime import datetime
from pathlib import Path

# Permite importar chatbot.py e process_pdf.py, que ficam na raiz do
# repositório (um nível acima da pasta api/).
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT_DIR))

from flask import Flask, jsonify, request, session  # noqa: E402

from chatbot import gerar_feedback, gerar_resposta  # noqa: E402
from process_pdf import extrair_texto_pdf  # noqa: E402

app = Flask(__name__)
app.secret_key = "um_segredo_aleatorio_para_sessoes"  # necessário para usar session

# Lista de PDFs disponíveis (mesmos arquivos da raiz do repositório)
arquivos_pdf = ["requisitos.pdf", "requisitos2.pdf", "requisitos3.pdf"]


def carregar_contexto():
    # Se já tem um PDF escolhido na sessão, mantém o mesmo
    if "caminho_pdf" not in session:
        session["caminho_pdf"] = random.choice(arquivos_pdf)
        # Caminho absoluto: o sistema de arquivos da função é somente
        # leitura, mas ler os PDFs incluídos no deploy funciona normalmente.
        caminho_absoluto = str(ROOT_DIR / session["caminho_pdf"])
        session["contexto"] = extrair_texto_pdf(caminho_absoluto)
    return session["contexto"]


@app.route("/api/pergunta", methods=["POST"])
def pergunta():
    contexto = carregar_contexto()
    pergunta_usuario = request.form["pergunta"]

    if pergunta_usuario.lower().strip() == "sair":
        conversa = session.get("historico", [])
        resposta = gerar_feedback(conversa)
    else:
        resposta = gerar_resposta(pergunta_usuario, contexto)
        historico = session.get("historico", [])
        historico.append(f"Aluno: {pergunta_usuario}\nStakeholder: {resposta}")
        session["historico"] = historico

    data_hora = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
    return jsonify({"resposta": resposta, "data_hora": data_hora})
