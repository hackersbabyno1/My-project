from flask import Flask, render_template, request, jsonify
import os
import socket
from bot_core import BOT_NAME, get_health_status, generate_reply, load_memory

app = Flask(__name__)

@app.route('/healthz')
def healthz():
    return "OK - Lungs working fine!", 200

@app.route('/api/status')
def api_status():
    return jsonify(get_health_status(source_env="Termux-Web"))

@app.route('/api/memory')
def api_memory():
    mem = load_memory()
    return jsonify({
        "user_name": mem.get("user_name", "ป๋า"),
        "birth_date": mem.get("birth_date", "2026-11-11"),
        "total_memories": mem.get("total_memories", 0),
        "recent_chats": mem.get("chat_history", [])[-10:]
    })

@app.route('/')
def index():
    return render_template('index.html', bot_name=BOT_NAME)

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.get_json(silent=True) or {}
    user_message = data.get('message', '').strip()
    reply = generate_reply(user_message, source_env="Termux-Web")
    return jsonify({"reply": reply})

def find_free_port(start_port=18888):
    port = start_port
    while port < 65535:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('0.0.0.0', port))
                return port
            except OSError:
                port += 1
    return start_port

if __name__ == '__main__':
    env_port = os.environ.get('PORT')
    port = int(env_port) if env_port else find_free_port(18888)
    print(f"[*] {BOT_NAME} (Termux Web) running on port: {port}")
    app.run(host='0.0.0.0', port=port, debug=True)
