import os
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

# Lista de PDFs disponíveis — a pasta pdfs/ fica na RAIZ do repositório,
# não dentro de api/, por isso usamos ROOT_DIR (não o diretório deste arquivo).
PDF_DIR = ROOT_DIR / "pdfs"

arquivos_pdf = [
    arquivo
    for arquivo in os.listdir(PDF_DIR)
    if arquivo.lower().endswith(".pdf")
]


def carregar_contexto():
    if "caminho_pdf" not in session:
        session["caminho_pdf"] = random.choice(arquivos_pdf)
        caminho_absoluto = str(PDF_DIR / session["caminho_pdf"])
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