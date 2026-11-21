import ast, datetime, fcntl, importlib.util, json, os, tempfile

TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
HOME = os.path.expanduser("~")
GH_DIR = os.path.join(HOME, "work_new/github_render_clean")
CORE_V1_PATH = os.path.join(GH_DIR, "new_scripts/bot_core_render_v1.py")
DEFAULT_MEM_PATH = os.path.join(GH_DIR, "memory.json")

def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lock_path = path + ".lock"
    with open(lock_path, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".rbr_", suffix=".tmp")
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

def load_core_v1(core_path=CORE_V1_PATH):
    spec = importlib.util.spec_from_file_location("bot_core_render_v1", core_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def get_render_status(mem_path=DEFAULT_MEM_PATH):
    now_th = datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d %H:%M:%S")
    mem_exists = os.path.exists(mem_path)
    mem_bytes = os.path.getsize(mem_path) if mem_exists else 0
    last_unified = None
    chat_len = 0
    if mem_exists:
        try:
            with open(mem_path, "r", encoding="utf-8", errors="ignore") as f:
                data = json.load(f)
            if isinstance(data, dict):
                last_unified = data.get("last_unified")
                chats = data.get("chat_history")
                if isinstance(chats, list):
                    chat_len = len(chats)
        except Exception:
            pass
    return {
        "ok": True,
        "checked_at_th_24h": now_th,
        "admin_agent": "brother_15001",
        "twin_bot": "twin_25003",
        "render_port": int(os.environ.get("PORT", "10000")),
        "core_module": "bot_core_render_v1.py",
        "core_exists": os.path.exists(CORE_V1_PATH),
        "memory_path": mem_path,
        "memory_exists": mem_exists,
        "memory_bytes": mem_bytes,
        "last_unified": last_unified,
        "chat_history_count": chat_len,
    }

def dispatch_chat_render(msg, source_env="render_web", mem_path=DEFAULT_MEM_PATH):
    mod = load_core_v1(CORE_V1_PATH)
    reply = mod.handle_message(msg, source_env=source_env, mem_path=mem_path)
    return {
        "ok": True,
        "reply": reply,
        "source_env": source_env,
        "updated_at_th_24h": datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d %H:%M:%S"),
    }

if __name__ == "__main__":
    with open(__file__, "r", encoding="utf-8") as sf:
        ast.parse(sf.read())
