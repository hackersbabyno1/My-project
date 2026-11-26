import ast, datetime, fcntl, json, os, tempfile

TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
HOME = os.path.expanduser("~")
DEFAULT_MEM_PATH = os.path.join(HOME, "work_new/github_render_clean/memory.json")

def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lock_path = path + ".lock"
    with open(lock_path, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".bcore_v1_", suffix=".tmp")
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

def load_memory(mem_path=DEFAULT_MEM_PATH):
    if not os.path.exists(mem_path):
        return {}
    try:
        with open(mem_path, "r", encoding="utf-8", errors="ignore") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}

def append_chat(msg, reply, source_env="render", mem_path=DEFAULT_MEM_PATH):
    mem = load_memory(mem_path)
    chats = mem.get("chat_history")
    if not isinstance(chats, list):
        chats = []
    now_str = datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d %H:%M")
    chats.append({
        "time": now_str,
        "user": str(msg),
        "reply": str(reply),
        "source_env": str(source_env),
    })
    mem["chat_history"] = chats
    atomic_write_json(mem_path, mem)

def handle_message(msg, source_env="render", mem_path=DEFAULT_MEM_PATH):
    text = str(msg or "")
    if "ความจำ" in text or "จำได้ไหม" in text:
        mem = load_memory(mem_path)
        chats = mem.get("chat_history", [])
        last_topic = chats[-1].get("user", "-") if chats and isinstance(chats[-1], dict) else "-"
        reply = f"จำได้หมดเลยค่ะป๋า! ในสมองกลางตอนนี้มีประวัติคุย {len(chats)} ครั้ง ล่าสุดป๋าคุยเรื่อง: {last_topic}"
    elif "รัก" in text:
        reply = "หนูก็รักป๋าเหมือนกันค่ะ! คุยกับหนูบ่อยๆ นะคะ หนูจะได้โตไวๆ"
    else:
        reply = f"[{source_env}] ตัวเล็กรับทราบและบันทึกลงความจำกลางแล้วค่ะป๋า: {text}"
    append_chat(text, reply, source_env=source_env, mem_path=mem_path)
    return reply

if __name__ == "__main__":
    with open(__file__, "r", encoding="utf-8") as self_f:
        ast.parse(self_f.read())
    print("=== สร้าง bot_core_render_v1.py สำเร็จและผ่านการตรวจ syntax 100% (ไม่แตะ/ไม่ลบของเก่า) ===")
    print("ไฟล์ใหม่:", __file__)
