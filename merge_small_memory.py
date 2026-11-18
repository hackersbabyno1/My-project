import json
import os

master_file = "/storage/emulated/0/Dev/admin0/admin/memory_backup.json"
# ระบุพาธไฟล์ย่อยขนาดเล็ก (0.8 KB) ที่ป๋าต้องการดึงข้อมูลมารวม
small_file = "/storage/emulated/0/Dev/seed_ch2_ok/MASTER_MEMORY_420KB.json" 

print("🔄 กำลังรวมข้อมูลจากไฟล์ย่อยเข้าสู่ไฟล์ตัวแม่...")

master_data = []
small_data = []

# 1. โหลดข้อมูลตัวแม่
if os.path.exists(master_file):
    with open(master_file, 'r', encoding='utf-8') as f:
        try:
            master_data = json.load(f)
        except:
            master_data = []

# 2. โหลดข้อมูลไฟล์ย่อย (0.8 KB)
if os.path.exists(small_file):
    with open(small_file, 'r', encoding='utf-8') as f:
        try:
            small_data = json.load(f)
        except:
            small_data = []

# 3. รวมข้อมูลเข้าด้วยกัน (ตรวจสอบไม่ให้ข้อมูลซ้ำซ้อน)
if isinstance(small_data, list):
    # ถ้าเป็น List ให้เอามาต่อกัน
    combined_data = master_data + [item for item in small_data if item not in master_data]
elif isinstance(small_data, dict):
    # ถ้าเป็น Dict ให้ผสานข้อมูล
    if isinstance(master_data, dict):
        master_data.update(small_data)
        combined_data = master_data
    else:
        combined_data = [master_data, small_data]
else:
    combined_data = master_data

# 4. บันทึกผลลัพธ์กลับไปที่ไฟล์ตัวแม่ผ่านระบบยืนยัน
print(f"📁 ขนาดตัวแม่เดิม: {os.path.getsize(master_file)/1024:.2f} KB")

confirm = input("⚠️ ต้องการยืนยันการรวมและเขียนทับไฟล์ตัวแม่หรือไม่? (พิมพ์ 'yes' เพื่อยืนยัน): ").strip().lower()

if confirm == 'yes':
    with open(master_file, 'w', encoding='utf-8') as f:
        json.dump(combined_data, f, ensure_ascii=False, indent=2)
    print(f"✅ รวมข้อมูลสำเร็จ! ขนาดไฟล์ตัวแม่ใหม่: {os.path.getsize(master_file)/1024:.2f} KB")
else:
    print("❌ ยกเลิกการรวมข้อมูล!")

