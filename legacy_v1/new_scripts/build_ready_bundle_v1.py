import ast, datetime, fcntl, importlib.util, json, os, shutil, tempfile

TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
HOME = os.path.expanduser("~")
GH_DIR = os.path.join(HOME, "work_new/github_render_clean")
NEW_SCRIPTS = os.path.join(GH_DIR, "new_scripts")
MEM_FILE = os.path.join(GH_DIR, "memory.json")
CORE_V1 = os.path.join(NEW_SCRIPTS, "bot_core_render_v1.py")
BRIDGE_V1 = os.path.join(NEW_SCRIPTS, "render_bridge_v1.py")
APP_V1 = os.path.join(NEW_SCRIPTS, "render_app_v1.py")
MANIFEST_OUT = os.path.join(NEW_SCRIPTS, "ready_bundle_manifest_v1.json")

READY_FILES = [
    "Procfile",
    "requirements.txt",
    "templates/index.html",
    "memory.json",
    "new_scripts/bot_core_render_v1.py",
    "new_scripts/render_bridge_v1.py",
    "new_scripts/render_app_v1.py",
]

def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lock_path = path + ".lock"
    with open(lock_path, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".rbdl_", suffix=".tmp")
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

def check_files():
    rows = []
    all_ok = True
    for rel in READY_FILES:
        fp = os.path.join(GH_DIR, rel)
        exists = os.path.exists(fp)
        sz = os.path.getsize(fp) if exists else 0
        ok = exists and sz > 0
        note = "ok" if ok else "missing_or_empty"
        if exists and rel.endswith(".py"):
            try:
                with open(fp, "r", encoding="utf-8", errors="replace") as f:
                    ast.parse(f.read())
                note = "ast_ok"
            except SyntaxError as e:
                ok = False
                note = f"syntax_err_line_{e.lineno}"
        elif exists and rel.endswith(".json"):
            try:
                with open(fp, "r", encoding="utf-8", errors="replace") as f:
                    json.load(f)
                note = "json_ok"
            except Exception as e:
                ok = False
                note = f"json_err:{e}"
        if not ok:
            all_ok = False
        rows.append({"rel_path": rel, "exists": exists, "bytes": sz, "ok": ok, "note": note})
    return all_ok, rows

def run_ready_check():
    all_ok, rows = check_files()
    sandbox_mem = os.path.join(tempfile.gettempdir(), "ready_bundle_smoke_mem.json")
    if os.path.exists(MEM_FILE):
        shutil.copy2(MEM_FILE, sandbox_mem)

    spec = importlib.util.spec_from_file_location("render_app_v1", APP_V1)
    app_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(app_mod)

    test_app = app_mod.create_app(mem_path=sandbox_mem)
    health_ok = False
    chat_reply = None
    last_uni = None
    chat_cnt = 0

    if test_app is not None:
        client = test_app.test_client()
        h = client.get("/health").get_json() or {}
        health_ok = bool(h.get("ok"))
        st = h.get("status") or {}
        last_uni = st.get("last_unified")
        chat_cnt = st.get("chat_history_count", 0)
        c = client.post("/api/chat", json={"message": "บอทพี่พร้อมใช้แล้ว", "source_env": "ready_bundle_check"}).get_json() or {}
        chat_reply = c.get("reply")

    manifest = {
        "checked_at_th_24h": datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d %H:%M:%S"),
        "admin_agent": "brother_15001",
        "policy": "never_delete_or_modify_old_files",
        "all_files_ok": all_ok,
        "flask_health_ok": health_ok,
        "last_unified": last_uni,
        "chat_history_count": chat_cnt,
        "sample_reply": chat_reply,
        "files": rows,
    }
    atomic_write_json(MANIFEST_OUT, manifest)
    return manifest

if __name__ == "__main__":
    with open(__file__, "r", encoding="utf-8") as sf:
        ast.parse(sf.read())
    m = run_ready_check()
    print(f"=== ชุดพร้อมใช้ ณ {m['checked_at_th_24h']} | all_files_ok={m['all_files_ok']} | flask_health_ok={m['flask_health_ok']} ===")
    for r in m["files"]:
        print(f" - {r['rel_path']} ({r['bytes']} bytes) -> {r['note']}")
    print(f"last_unified={m['last_unified']} | chats={m['chat_history_count']}")
    print(f"ผลตอบกลับทดสอบ: {m['sample_reply']}")
    print(f"บันทึกบัญชีชุดพร้อมใช้: {MANIFEST_OUT}")
