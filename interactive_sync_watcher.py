import os
import json
import time
import shutil

master_source = "/storage/emulated/0/Dev/admin0/admin/memory_backup.json"
target_file = "/storage/emulated/0/Dev/seed_ch2_ok/MASTER_MEMORY_420KB.json"

print("🛡️ [Interactive Guardian] เปิดระบบเฝ้าระวังการเขียนทับ...")
print(f"📁 เฝ้าระวังไฟล์: {master_source}")
print("⚡ สถานะ: หากมีการเปลี่ยนแปลง/เขียนทับ ระบบจะเด้งถามให้ป๋ากด 'yes' ยืนยันทุกครั้งทันที")
print("*(กด Ctrl+C เพื่อหยุดการทำงาน)*\n")

last_mtime = os.path.getmtime(master_source) if os.path.exists(master_source) else 0

try:
    while True:
        if os.path.exists(master_source):
            current_mtime = os.path.getmtime(master_source)
            
            # ถ้าตรวจพบว่าไฟล์ต้นทางมีการเปลี่ยนแปลง (ถูกเขียนทับหรืออัปเดตใหม่)
            if current_mtime != last_mtime:
                print("\n🔔 [Security Alert] ตรวจพบการเขียนทับ/เปลี่ยนแปลงไฟล์ตัวแม่!")
                print(f"📁 ไฟล์: {master_source}")
                
                # บังคับถามยืนยัน 1 สเต็ป
                confirm = input("⚠️ ต้องการยืนยันซิงค์ข้อมูลนี้ไปยังไฟล์ปลายทางหรือไม่? (พิมพ์ 'yes' เพื่อยืนยัน): ").strip().lower()
                
                if confirm == 'yes':
                    try:
                        shutil.copy(master_source, target_file)
                        print("✅ ผ่านการยืนยัน! ซิงค์ไฟล์ปลายทางเรียบร้อยแล้วครับป๋า")
                    except Exception as e:
                        print(f"❌ ซิงค์ไม่สำเร็จ: {e}")
                else:
                    print("❌ ยกเลิกการซิงค์! คงข้อมูลปลายทางเดิมไว้ปลอดภัย")
                
                last_mtime = current_mtime
                
        time.sleep(3) # เช็กทุกๆ 3 วิ
        
except KeyboardInterrupt:
    print("\n🛑 ปิดระบบเฝ้าระวังเรียบร้อยครับป๋า")
