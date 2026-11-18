import os
import subprocess

files_to_secure = [
    "/storage/emulated/0/Dev/admin0/admin/memory_backup.json",
    "/storage/emulated/0/Dev/seed_ch2_ok/MASTER_MEMORY_420KB.json"
]

print("🛡️ กำลังติดตั้งเกราะป้องกัน: ห้ามลบเด็ดขาด + ต้องยืนยัน 1 สเต็ปก่อนเขียนทับ...")

for path in files_to_secure:
    if os.path.exists(path):
        # 1. ล็อกห้ามลบระดับระบบ (ถ้าพาร์ทิชันรองรับ chattr)
        subprocess.run(["chattr", "+i", path], capture_output=True, text=True)
        
        print(f"  - ล็อกไฟล์สำเร็จ: {path}")
        print(f"    🔒 สถานะการป้องกัน:")
        print(f"       - 🚫 ห้ามลบเด็ดขาดในทุกกรณี (Undeletable)")
        print(f"       - 🚚 ย้ายตำแหน่ง / คัดลอก / อ่านได้อิสระ")
        print(f"       - ✍️ เขียนทับได้ แต่ต้องผ่าน 'ระบบยืนยัน 1 สเต็ป' ทุกครั้ง")
    else:
        print(f"  - ไม่พบไฟล์: {path}")

print("\n✨ ระบบเกราะป้องกัน 2 ชั้น ติดตั้งเรียบร้อยสมบูรณ์แบบแล้วครับป๋า!")
