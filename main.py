import os
import sys

MASTER_DIR = "/data/data/com.termux/files/home/ai_girl_bot"
DEV_BOT_DIR = "/storage/emulated/0/Dev/ai_girl_bot"
for p in (MASTER_DIR, DEV_BOT_DIR):
    if os.path.isdir(p) and p not in sys.path:
        sys.path.insert(0, p)

from bot_core import get_health_status, generate_reply

def detect_env():
    if os.path.exists("/etc/debian_version"):
        return "Debian"
    return "Termux-CLI"

def run_status_display():
    env = detect_env()
    h = get_health_status(source_env=env)
    st = h["stats"]
    print(
        f"🤖 สถานะบอท ({env}): ทำงานปกติ | อายุระบบ: {h['age_info']} | "
        f"ความจำกลาง: {st['chat_count']} แชท, {st['history_count']+st['code_files_count']} โค้ด, {st['commands_count']} คำสั่ง"
    )

if __name__ == "__main__":
    env = detect_env()
    if len(sys.argv) > 1:
        msg = " ".join(sys.argv[1:])
        print(generate_reply(msg, source_env=env))
    else:
        run_status_display()
