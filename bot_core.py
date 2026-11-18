import os
import json
import time
import fcntl
import shutil
import datetime

MASTER_DIR = "/data/data/com.termux/files/home/ai_girl_bot"
DEV_BOT_DIR = "/storage/emulated/0/Dev/ai_girl_bot"
ALLOWED_BOUNDARY = "/storage/emulated/0/Dev"
TEMP_DOWNLOAD_DIR = "/storage/emulated/0/Download"

# ใช้ศูนย์กลาง /data เป็นหลัก ถ้าไม่มีจึงใช้ /storage/emulated/0/Dev
BASE_DIR = MASTER_DIR if os.path.isdir(MASTER_DIR) else DEV_BOT_DIR
MEMORY_FILE = os.path.join(BASE_DIR, "memory.json")
LOCK_FILE = os.path.join(BASE_DIR, ".memory.lock")

BOT_NAME = "บอทตัวน้อย (ตัวเล็ก)"
BOT_BIRTHDAY = datetime.datetime(2026, 11, 11)
START_TIME = time.time()

def safe_file_access(file_path, mode="read"):
    abs_path = os.path.abspath(file_path)
    if abs_path.startswith(os.path.abspath(MASTER_DIR)):
        return True
    if mode in ["read", "search", "access"]:
        return abs_path == ALLOWED_BOUNDARY or abs_path.startswith(ALLOWED_BOUNDARY + os.sep)
    elif mode == "temp_download":
        return abs_path.startswith(TEMP_DOWNLOAD_DIR) or abs_path.startswith(ALLOWED_BOUNDARY + os.sep)
    return False

def get_health_status(source_env="Termux"):
    now = datetime.datetime.now()
    date_str = now.strftime("%d-%m-%Y")
    thai_year = str(now.year + 543)[-2:]
    formatted_date = f"{date_str}/{thai_year}"

    delta = now - BOT_BIRTHDAY
    age_days = max(1, delta.days + 1)
    uptime_sec = int(time.time() - START_TIME)

    # อ่านอุณหภูมิเครื่อง Android (ถ้าเข้าถึงได้)
    temp_c = "+25°C"
    for tz in ["/sys/class/thermal/thermal_zone0/temp", "/sys/class/thermal/thermal_zone1/temp"]:
        if os.path.isfile(tz):
            try:
                with open(tz, "r") as f:
                    val = float(f.read().strip())
                if val > 1000:
                    val /= 1000.0
                if 15.0 <= val <= 95.0:
                    temp_c = f"+{val:.1f}°C"
                    break
            except Exception:
                pass

    mem = load_memory()
    return {
        "status": "OK - Lungs, Heart & Liver working fine!",
        "bot_name": BOT_NAME,
        "source_env": source_env,
        "memory_file": MEMORY_FILE,
        "weather": temp_c,
        "date_info": formatted_date,
        "age_info": f"*{age_days} D*",
        "uptime_sec": uptime_sec,
        "stats": {
            "history_count": len(mem.get("history", [])),
            "code_files_count": len(mem.get("termux_code_files", [])),
            "commands_count": len(mem.get("termux_commands", [])),
            "chat_count": len(mem.get("chat_history", [])),
        }
    }

def load_memory():
    if not os.path.isfile(MEMORY_FILE):
        return {"user_name": "ป๋า", "birth_date": "2026-11-11", "chat_history": [], "history": []}
    with open(LOCK_FILE, "w") as lf:
        fcntl.flock(lf, fcntl.LOCK_SH)
        try:
            with open(MEMORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        finally:
            fcntl.flock(lf, fcntl.LOCK_UN)

def append_chat(user_msg, bot_reply, source_env="Termux"):
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOCK_FILE, "w") as lf:
        fcntl.flock(lf, fcntl.LOCK_EX)
        try:
            if os.path.isfile(MEMORY_FILE):
                with open(MEMORY_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
            else:
                data = {"user_name": "ป๋า", "birth_date": "2026-11-11", "chat_history": []}

            data.setdefault("chat_history", []).append({
                "time": now_str,
                "env": source_env,
                "user": user_msg,
                "bot": bot_reply
            })
            data["last_updated"] = now_str
            data["total_memories"] = (
                len(data.get("history", []))
                + len(data.get("termux_code_files", []))
                + len(data.get("chat_history", []))
            )

            tmp_file = MEMORY_FILE + ".tmp"
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(tmp_file, MEMORY_FILE)

            # ซิงก์เงาให้ไฟล์สำรองอ่านตรงกันเสมอ
            try:
                m420 = os.path.join(BASE_DIR, "MASTER_MEMORY_420KB.json")
                if os.path.isdir(BASE_DIR):
                    shutil.copy2(MEMORY_FILE, m420)
                if os.path.isdir(DEV_BOT_DIR) and BASE_DIR != DEV_BOT_DIR:
                    shutil.copy2(MEMORY_FILE, os.path.join(DEV_BOT_DIR, "memory.json"))
            except Exception:
                pass
            return data
        finally:
            fcntl.flock(lf, fcntl.LOCK_UN)

def generate_reply(user_message, source_env="Termux"):
    msg = (user_message or "").strip()
    if not msg:
        return "พิมอะไรหน่อยสิคะป๋า ตัวเล็กเหงานะคะ 🥺"

    if "สวัสดี" in msg or "ดีจ้า" in msg:
        reply = f"สวัสดีค่ะป๋า! {BOT_NAME} ({source_env}) เชื่อมความจำศูนย์กลางพร้อมรับคำสั่งแล้วค่ะ มีอะไรให้ตัวเล็กช่วยไหมคะ? ❤️"
    elif "สถานะ" in msg or "เช็ค" in msg or "สุขภาพ" in msg:
        h = get_health_status(source_env)
        st = h["stats"]
        reply = (
            f"เช็คตับไตไส้พุงแล้วค่ะป๋า ({source_env})! อายุ {h['age_info']} | "
            f"ความจำรวม {st['chat_count']} แชท, {st['history_count']+st['code_files_count']} โค้ด, {st['commands_count']} คำสั่ง ปอดหัวใจปกติค่ะ!"
        )
    elif "ความจำ" in msg or "จำได้ไหม" in msg:
        mem = load_memory()
        chats = mem.get("chat_history", [])
        last_topic = chats[-1].get("user", "-") if chats else "-"
        reply = f"จำได้หมดเลยค่ะป๋า! ในสมองกลางตอนนี้มีประวัติคุย {len(chats)} ครั้ง ล่าสุดป๋าคุยเรื่อง: {last_topic}"
    elif "รัก" in msg:
        reply = "หนูก็รักป๋าเหมือนกันค่ะ! คุยกับหนูบ่อยๆ นะคะ หนูจะได้โตไวๆ 💖✨"
    else:
        reply = f"[{source_env}] ตัวเล็กรับทราบและบันทึกลงความจำกลางแล้วค่ะป๋า: {msg}"

    append_chat(msg, reply, source_env=source_env)
    return reply
