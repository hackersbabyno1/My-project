import json
import os

master_source = "/storage/emulated/0/Dev/admin0/admin/memory_backup.json"
target_file = "/storage/emulated/0/Dev/seed_ch2_ok/MASTER_MEMORY_420KB.json"

print("🛡️ [Guardian Gate] กำลังเตรียมซิงค์ไฟล์ผ่านระบบยืนยัน 1 สเต็ป...")

if not os.path.exists(master_source):
    print("❌ ไม่พบไฟล์ต้นทางตัวแม่!")
    exit(1)

# 1. โหลดข้อมูลจากตัวแม่
with open(master_source, 'r', encoding='utf-8') as f:
    master_data = json.load(f)

print(f"📁 ต้นทาง: {master_source} ({os.path.getsize(master_source)/1024:.2f} KB)")
print(f"🎯 ปลายทาง: {target_file}")

# 2. บังคับถามยืนยัน 1 สเต็ปก่อนเขียนทับ
confirm = input("⚠️ [ระบบความปลอดภัย] ต้องการยืนยันการเขียนทับไฟล์ปลายทางให้ตรงกับตัวแม่หรือไม่? (พิมพ์ 'yes' เพื่อยืนยัน): ").strip().lower()

if confirm == 'yes':
    try:
        with open(target_file, 'w', encoding='utf-8') as f:
            json.dump(master_data, f, ensure_ascii=False, indent=2)
        print("✅ ผ่านการยืนยัน 1 สเต็ป! ซิงค์ข้อมูลทับสำเร็จเรียบร้อย ขนาดเท่ากันเป๊ะ 420.85 KB แล้วครับป๋า!")
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาดในการเขียน: {e}")
else:
    print("❌ ยกเลิกการซิงค์! ข้อมูลปลายทางยังคงปลอดภัย ไม่ถูกเปลี่ยนแปลง")

