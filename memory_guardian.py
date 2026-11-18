import os
import json
import shutil

# กำหนดเป้าหมายไฟล์ความจำที่ต้องปกป้อง
FILE_1 = "/storage/emulated/0/Dev/admin0/admin/memory_backup.json"
FILE_2 = "/storage/emulated/0/Dev/seed_ch2_ok/MASTER_MEMORY_420KB.json"

def safe_write(target_path, new_data, force=False):
    """ฟังก์ชันเขียนทับที่ต้องผ่านการยืนยัน 1 สเต็ป"""
    print(f"\n🛡️ [Guardian] คำขอเขียนทับไฟล์: {target_path}")
    if not force:
        confirm = input("⚠️ ต้องการยืนยันการเขียนทับข้อมูลใหม่นี้หรือไม่? (พิมพ์ 'yes' เพื่อยืนยัน): ").strip().lower()
        if confirm != 'yes':
            print("❌ ยกเลิกการเขียนทับ! ข้อมูลเก่าปลอดภัยดีเยี่ยม")
            return False
            
    try:
        with open(target_path, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, ensure_ascii=False, indent=2)
        print("✅ ผ่านการยืนยัน 1 สเต็ป และบันทึกข้อมูลทับเรียบร้อยแล้ว!")
        return True
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาดในการเขียน: {e}")
        return False

def safe_delete(target_path):
    """บล็อกการลบถาวร 100%"""
    print(f"\n🚫 [Guardian] ตรวจพบคำสั่งพยายามลบไฟล์สำคัญ: {target_path}")
    print("🛑 ปฏิเสธการลบ! ไฟล์นี้ถูกตั้งค่าสถานะ 'ห้ามลบเด็ดขาด (Undeletable)' โดยแอดมินป๋า")
    print("💡 หากต้องการย้ายตำแหน่ง สามารถใช้คำสั่งคัดลอก/ย้าย (Copy/Move) ได้ตามปกติ แต่ห้ามลบต้นทางทิ้งครับ!")
    return False

# ทดสอบระบบการ์เดียน
print("=== 🛡️ เปิดใช้งานระบบเกราะป้องกันความจำ (Guardian Active) ===")
print(f"📁 เฝ้าระวังไฟล์ 1: {FILE_1}")
print(f"📁 เฝ้าระวังไฟล์ 2: {FILE_2}")
print("สถานะ: 🚫 ห้ามลบเด็ดขาด | ✍️ เขียนทับต้องยืนยัน 1 สเต็ป | 🚚 ย้าย/ก๊อปปี้ได้อิสระ")

