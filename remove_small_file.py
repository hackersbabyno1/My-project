import os

target_file = "/storage/emulated/0/Dev/seed_ch2_ok/MASTER_MEMORY_420KB.json"

print("🗑️ กำลังลบไฟล์ความจำขนาดเล็กตัวเก่า...")

if os.path.exists(target_file):
    try:
        os.remove(target_file)
        print(f"✅ ลบไฟล์สำเร็จเรียบร้อย: {target_file}")
        print("✨ เคลียร์พื้นที่เรียบร้อย ตอนนี้เหลือเฉพาะไฟล์ตัวแม่ศูนย์กลางที่ปลอดภัยและสมบูรณ์ที่สุดแล้วครับป๋า!")
    except Exception as e:
        print(f"❌ ไม่สามารถลบไฟล์ได้: {e}")
else:
    print("ℹ️ ไม่พบไฟล์ดังกล่าวในระบบ (อาจจะถูกลบไปแล้ว)")

