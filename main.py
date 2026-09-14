import os

from flask import Flask, request, jsonify, session, send_from_directory
from process_pdf import extrair_texto_pdf
from chatbot import gerar_feedback, gerar_resposta
from datetime import datetime
import random

app = Flask(__name__, static_folder="frontend/dist", static_url_path="")
app.secret_key = "um_segredo_aleatorio_para_sessoes"  # necessário para usar session

arquivos_pdf = ["requisitos.pdf", "requisitos2.pdf", "requisitos3.pdf"]

def carregar_contexto():

    if "caminho_pdf" not in session:
        session["caminho_pdf"] = random.choice(arquivos_pdf)
        session["contexto"] = extrair_texto_pdf(session["caminho_pdf"])
    return session["contexto"]

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def index(path):
    carregar_contexto()

    caminho_absoluto = os.path.join(app.static_folder, path)
    if path and os.path.isfile(caminho_absoluto):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/pergunta', methods=['POST'])
def pergunta():
    contexto = carregar_contexto()
    pergunta = request.form['pergunta']

    if pergunta.lower().strip() == "sair":
        conversa = session.get("historico", [])
        resposta = gerar_feedback(conversa)
    else:
        resposta = gerar_resposta(pergunta, contexto)
        historico = session.get("historico", [])
        historico.append(f"Aluno: {pergunta}\nStakeholder: {resposta}")
        session["historico"] = historico

    data_hora = datetime.now().strftime('%d-%m-%Y %H:%M:%S')
    return jsonify({'resposta': resposta, 'data_hora': data_hora})


if __name__ == "__main__":
    app.run(debug=True)