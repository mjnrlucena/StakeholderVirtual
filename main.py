import os
import random
from datetime import datetime

from flask import Flask, request, jsonify, session, send_from_directory
from process_pdf import extrair_texto_pdf
from chatbot import gerar_feedback, gerar_resposta


app = Flask(__name__, static_folder="frontend/dist", static_url_path="")
app.secret_key = "um_segredo_aleatorio_para_sessoes"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PDF_DIR = os.path.join(BASE_DIR, "pdfs")

arquivos_pdf = [
    arquivo
    for arquivo in os.listdir(PDF_DIR)
    if arquivo.lower().endswith(".pdf")
]

if not arquivos_pdf:
    raise FileNotFoundError(f"Nenhum PDF encontrado na pasta: {PDF_DIR}")

def carregar_contexto():
    if "caminho_pdf" not in session:
        session["caminho_pdf"] = random.choice(arquivos_pdf)

    caminho_pdf = os.path.join(PDF_DIR, session["caminho_pdf"])
    return extrair_texto_pdf(caminho_pdf)

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

    if request.is_json:
        pergunta = request.json.get('pergunta', '')
    else:
        pergunta = request.form.get('pergunta', '')

    if not pergunta:
        return jsonify({'erro': "Campo 'pergunta' não encontrado"}), 400

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

@app.route("/nova-conversa", methods=["POST"])
def nova_conversa():
    session.clear()
    return jsonify({"mensagem": "Nova conversa iniciada."})


if __name__ == "__main__":
    app.run(debug=True)