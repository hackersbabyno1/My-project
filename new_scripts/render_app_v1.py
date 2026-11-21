import ast, datetime, fcntl, importlib.util, json, os, tempfile

TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
HOME = os.path.expanduser("~")
GH_DIR = os.path.join(HOME, "work_new/github_render_clean")
NEW_SCRIPTS = os.path.join(GH_DIR, "new_scripts")
BRIDGE_PATH = os.path.join(NEW_SCRIPTS, "render_bridge_v1.py")
CORE_PATH = os.path.join(NEW_SCRIPTS, "bot_core_render_v1.py")
DEFAULT_MEM_PATH = os.environ.get("BOT_MEMORY_PATH", os.path.join(GH_DIR, "memory.json"))
TEMPLATE_DIR = os.path.join(GH_DIR, "templates")

def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lock_path = path + ".lock"
    with open(lock_path, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".rapp_", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as tf:
                json.dump(data, tf, ensure_ascii=False, indent=2)
            os.replace(tmp_path, path)
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
            fcntl.flock(lf.fileno(), fcntl.LOCK_UN)

def load_bridge_module(bridge_path=BRIDGE_PATH):
    spec = importlib.util.spec_from_file_location("render_bridge_v1", bridge_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def create_app(mem_path=DEFAULT_MEM_PATH):
    try:
        from flask import Flask, jsonify, render_template, request
    except ImportError:
        return None

    app = Flask(__name__, template_folder=TEMPLATE_DIR)

    @app.get("/health")
    def health():
        bridge = load_bridge_module(BRIDGE_PATH)
        st = bridge.get_render_status(mem_path=mem_path)
        return jsonify({
            "ok": True,
            "service": "render_app_v1",
            "core_exists": os.path.exists(CORE_PATH),
            "bridge_exists": os.path.exists(BRIDGE_PATH),
            "status": st,
        })

    @app.post("/api/chat")
    def api_chat():
        payload = request.get_json(silent=True) or {}
        msg = payload.get("message") or request.form.get("message") or ""
        source_env = payload.get("source_env") or "render_web"
        bridge = load_bridge_module(BRIDGE_PATH)
        res = bridge.dispatch_chat_render(msg, source_env=source_env, mem_path=mem_path)
        return jsonify(res)

    @app.get("/")
    def index():
        index_html = os.path.join(TEMPLATE_DIR, "index.html")
        if os.path.exists(index_html):
            return render_template("index.html")
        bridge = load_bridge_module(BRIDGE_PATH)
        return jsonify(bridge.get_render_status(mem_path=mem_path))

    return app

app = create_app()

if __name__ == "__main__":
    with open(__file__, "r", encoding="utf-8") as sf:
        ast.parse(sf.read())
    port = int(os.environ.get("PORT", "10000"))
    print(f"=== render_app_v1.py ผ่าน syntax 100% (พร้อมรันพอร์ต {port}, ไม่แตะ/ไม่ลบของเก่า) ===")
    if app is not None:
        app.run(host="0.0.0.0", port=port)
