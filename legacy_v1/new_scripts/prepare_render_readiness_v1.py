import ast, datetime, fcntl, importlib.util, json, os, shutil, tempfile

TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
HOME = os.path.expanduser("~")
GH_DIR = os.path.join(HOME, "work_new/github_render_clean")
NEW_SCRIPTS = os.path.join(GH_DIR, "new_scripts")
REPORT_PATH = os.path.join(NEW_SCRIPTS, "render_readiness_report_v1.json")

TARGETS = [
    "Procfile",
    "app.py",
    "main.py",
    "requirements.txt",
    "memory.json",
    "templates/index.html",
    "new_scripts/bot_core_render_v1.py",
    "new_scripts/render_bridge_v1.py",
]

def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lock_path = path + ".lock"
    with open(lock_path, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".rdy_", suffix=".tmp")
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

def inspect_target(rel_path):
    fp = os.path.join(GH_DIR, rel_path)
    info = {
        "rel_path": rel_path,
        "exists": os.path.exists(fp),
        "bytes": os.path.getsize(fp) if os.path.exists(fp) else 0,
        "ok": False,
        "detail": "",
    }
    if not info["exists"]:
        info["detail"] = "missing"
        return info

    ext = os.path.splitext(rel_path)[1].lower()
    with open(fp, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    if ext == ".py":
        try:
            ast.parse(content)
            info["ok"] = True
            info["detail"] = f"py_syntax_ok ({len(content.splitlines())} lines)"
        except SyntaxError as e:
            info["detail"] = f"syntax_error line {e.lineno}: {e.msg}"
    elif ext == ".json":
        try:
            parsed = json.loads(content)
            info["ok"] = isinstance(parsed, dict)
            info["detail"] = f"json_ok (keys={len(parsed) if isinstance(parsed, dict) else 'non-dict'})"
        except Exception as e:
            info["detail"] = f"json_error: {e}"
    elif rel_path == "requirements.txt":
        pkgs = [ln.strip() for ln in content.splitlines() if ln.strip() and not ln.strip().startswith("#")]
        info["ok"] = len(pkgs) > 0
        info["detail"] = f"packages={pkgs}"
    elif rel_path == "Procfile":
        procs = [ln.strip() for ln in content.splitlines() if ln.strip()]
        info["ok"] = len(procs) > 0
        info["detail"] = f"procs={procs}"
    else:
        info["ok"] = len(content.strip()) > 0
        info["detail"] = f"chars={len(content)}"
    return info

def run():
    checked = [inspect_target(p) for p in TARGETS]
    mem_src = os.path.join(GH_DIR, "memory.json")
    sandbox_mem = os.path.join(tempfile.gettempdir(), "render_readiness_mem_v1.json")
    if os.path.exists(mem_src):
        shutil.copy2(mem_src, sandbox_mem)

    bridge_path = os.path.join(NEW_SCRIPTS, "render_bridge_v1.py")
    spec = importlib.util.spec_from_file_location("render_bridge_v1", bridge_path)
    bridge = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bridge)

    st = bridge.get_render_status(mem_path=sandbox_mem)
    sample = bridge.dispatch_chat_render("ตรวจความพร้อม Render ชุดปัจจุบัน", source_env="readiness_check", mem_path=sandbox_mem)

    report = {
        "checked_at_th_24h": datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d %H:%M:%S"),
        "admin_agent": "brother_15001",
        "policy": "read_only_never_delete_or_modify_old_files",
        "targets": checked,
        "bridge_status": st,
        "sample_reply": sample.get("reply"),
    }
    atomic_write_json(REPORT_PATH, report)

    print("=== ตรวจความพร้อมชุดรัน Render (ไม่แตะ/ไม่ลบของเก่า) ===")
    for item in checked:
        print(f" - {item['rel_path']}: exists={item['exists']} | ok={item['ok']} | {item['detail']}")
    print("last_unified:", st.get("last_unified"), "| chats:", st.get("chat_history_count"), "| render_port:", st.get("render_port"))
    print("ผลตอบกลับทดสอบสายเชื่อม:", sample.get("reply"))
    print("บันทึกรายงาน:", REPORT_PATH)

if __name__ == "__main__":
    with open(__file__, "r", encoding="utf-8") as sf:
        ast.parse(sf.read())
    run()
