import json

true_master = "/storage/emulated/0/Dev/admin0/admin/memory_backup.json"
seed_file = "/storage/emulated/0/Dev/seed_ch2_ok/MASTER_MEMORY_420KB.json"

print("=== 🔍 เปรียบเทียบไฟล์ความจำ 2 ตัว ===")

def inspect_file(path, name):
    print(f"\n📁 [{name}] -> {path}")
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            print(f"  - วันเกิดบอท (birth_date): {data.get('birth_date')}")
            print(f"  - ชื่อผู้ใช้ (user_name): {data.get('user_name')}")
            history = data.get('chat_history', [])
            print(f"  - จำนวนประวัติการคุย (chat_history count): {len(history)} รายการ")
            if history:
                print(f"  - ตัวอย่างประวัติล่าสุดรายการแรก: {history[0]}")
    except Exception as e:
        print(f"  ❌ อ่านไฟล์ไม่ได้: {e}")

inspect_file(true_master, "ตัวแม่ตัวจริง (420 KB)")
inspect_file(seed_file, "ตัว 368 KB (Seed Ch2)")

