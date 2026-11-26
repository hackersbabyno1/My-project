import ast, datetime, fcntl, importlib.util, json, os, shutil, tempfile

TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
HOME = os.path.expanduser("~")
GH_DIR = os.path.join(HOME, "work_new/github_render_clean")
NEW_SCRIPTS_DIR = os.path.join(GH_DIR, "new_scripts")
MEM_FILE = os.path.join(GH_DIR, "memory.json")
CORE_V1_FILE = os.path.join(NEW_SCRIPTS_DIR, "bot_core_render_v1.py")
BRIDGE_V1_FILE = os.path.join(NEW_SCRIPTS_DIR, "render_bridge_v1.py")
INDEX_OUT = os.path.join(NEW_SCRIPTS_DIR, "all_files_chain_manifest_v1.json")

SKIP_DIRS = {".git", "__pycache__", ".venv", "venv", "node_modules"}
SKIP_EXTS = {".lock", ".tmp"}

def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lock_path = path + ".lock"
    with open(lock_path, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".allch_", suffix=".tmp")
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

def read_all_files_in_zone(root_dir):
    entries = []
    if not os.path.exists(root_dir):
        return entries
    for r, dirs, files in os.walk(root_dir):
        dirs[:] = sorted([d for d in dirs if d not in SKIP_DIRS])
        for fn in sorted(files):
            ext = os.path.splitext(fn)[1].lower()
            if ext in SKIP_EXTS:
                continue
            fp = os.path.join(r, fn)
            rel = os.path.relpath(fp, root_dir)
            try:
                st = os.stat(fp)
                rec = {
                    "rel_path": rel,
                    "abs_path": fp,
                    "ext": ext or "(no_ext)",
                    "bytes": st.st_size,
                    "modified_th_24h": datetime.datetime.fromtimestamp(st.st_mtime, TZ_TH).strftime("%Y-%m-%d %H:%M:%S"),
                    "readable": False,
                    "syntax_ok": None,
                }
                if ext == ".py":
                    with open(fp, "r", encoding="utf-8", errors="replace") as f:
                        src = f.read()
                    rec["readable"] = True
                    rec["lines"] = len(src.splitlines())
                    try:
                        ast.parse(src)
                        rec["syntax_ok"] = True
                    except SyntaxError as e:
                        rec["syntax_ok"] = False
                        rec["syntax_error"] = f"line {e.lineno}: {e.msg}"
                elif ext == ".json":
                    with open(fp, "r", encoding="utf-8", errors="replace") as f:
                        raw = f.read()
                    rec["readable"] = True
                    try:
                        parsed = json.loads(raw)
                        rec["json_ok"] = True
                        if isinstance(parsed, dict):
                            rec["json_keys_count"] = len(parsed)
                    except Exception as e:
                        rec["json_ok"] = False
                        rec["json_error"] = str(e)
                else:
                    with open(fp, "r", encoding="utf-8", errors="replace") as f:
                        preview = f.read(400)
                    rec["readable"] = True
                    rec["preview"] = preview.replace("\r", "")
                entries.append(rec)
            except Exception as e:
                entries.append({
                    "rel_path": rel,
                    "abs_path": fp,
                    "readable": False,
                    "error": str(e),
                })
    return entries

def run_full_chain_read():
    all_files = read_all_files_in_zone(GH_DIR)
    manifest = {
        "checked_at_th_24h": datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d %H:%M:%S"),
        "admin_agent": "brother_15001",
        "zone_dir": GH_DIR,
        "policy": "read_all_files_in_chain_never_delete_or_modify_old_files",
        "total_files_read": len(all_files),
        "files": all_files,
    }
    atomic_write_json(INDEX_OUT, manifest)

    # เชื่อมต่ออ่าน memory.json + bot_core_render_v1.py + render_bridge_v1.py (ผ่านไฟล์จำลองใน temp เพื่อไม่แตะความจำจริง)
    sandbox_mem = os.path.join(tempfile.gettempdir(), "read_all_chain_mem_v1.json")
    if os.path.exists(MEM_FILE):
        shutil.copy2(MEM_FILE, sandbox_mem)

    bridge_status = None
    sample_reply = None
    if os.path.exists(BRIDGE_V1_FILE):
        spec = importlib.util.spec_from_file_location("render_bridge_v1", BRIDGE_V1_FILE)
        bridge = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(bridge)
        bridge_status = bridge.get_render_status(mem_path=sandbox_mem)
        sample_reply = bridge.dispatch_chat_render("ตรวจอ่านครบทุกไฟล์แล้ว", source_env="all_files_chain", mem_path=sandbox_mem)

    return manifest, bridge_status, sample_reply

if __name__ == "__main__":
    with open(__file__, "r", encoding="utf-8") as sf:
        ast.parse(sf.read())
    manifest, b_status, s_reply = run_full_chain_read()
    print(f"=== อ่านครบทุกไฟล์ใน {GH_DIR} แล้ว: {manifest['total_files_read']} ไฟล์ (ไม่แตะ/ไม่ลบของเก่า) ===")
    for item in manifest["files"]:
        extra = ""
        if item.get("syntax_ok") is not None:
            extra = f" | syntax_ok={item['syntax_ok']}"
        elif item.get("json_ok") is not None:
            extra = f" | json_ok={item['json_ok']}"
        print(f" - {item['rel_path']} ({item.get('bytes', 0)} bytes){extra}")
    if b_status:
        print("สถานะความจำที่อ่านได้:", b_status.get("last_unified"), "| chats:", b_status.get("chat_history_count"))
    if s_reply:
        print("ผลทดสอบตอบกลับ:", s_reply.get("reply"))
