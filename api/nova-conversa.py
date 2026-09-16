from flask import Flask, jsonify, session

app = Flask(__name__)
app.secret_key = "um_segredo_aleatorio_para_sessoes"


@app.route("/api/nova-conversa", methods=["POST"])
def nova_conversa():
    session.clear()
    return jsonify({"mensagem": "Nova conversa iniciada."})