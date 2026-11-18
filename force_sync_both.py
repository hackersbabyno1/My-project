import shutil
import os

master_source = "/storage/emulated/0/Dev/admin0/admin/memory_backup.json"
target_file = "/storage/emulated/0/Dev/seed_ch2_ok/MASTER_MEMORY_420KB.json"

print("🔄 กำลังซิงค์ไฟล์ความจำให้เป็นเวอร์ชันเดียวกันเป๊ะ...")

if os.path.exists(master_source):
    # คัดลอกตัวแม่ไปทับตัว seed เพื่อให้ข้อมูลตรงกัน 100%
    shutil.copy(master_source, target_file)
    
    master_size = os.path.getsize(master_source) / 1024
    target_size = os.path.getsize(target_file) / 1024
    
    print(f"✅ ซิงค์สำเร็จเรียบร้อย!")
    print(f"  - ไฟล์ต้นทาง (Master): {master_size:.2f} KB")
    print(f"  - ไฟล์ปลายทาง (Target): {target_size:.2f} KB")
    print("✨ ตอนนี้ทั้งสองไฟล์มีเนื้อหา ประวัติ และข้อมูลทุกอย่างตรงกันเป๊ะ 100% แล้วครับป๋า!")
else:
    print("❌ ไม่พบไฟล์ต้นทางตัวแม่!")

