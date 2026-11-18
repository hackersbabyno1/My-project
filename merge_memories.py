import json
import os

master_path = "/storage/emulated/0/Dev/admin0/admin/memory_backup.json"
seed_path = "/storage/emulated/0/Dev/seed_ch2_ok/MASTER_MEMORY_420KB.json"
output_path = "/storage/emulated/0/Dev/admin0/admin/memory_merged_ultimate.json"

print("🔄 กำลังอ่านและรวมไฟล์ความจำทั้งสองตัว...")

try:
    # โหลดไฟล์ตัวแม่ (420 KB)
    with open(master_path, 'r', encoding='utf-8') as f:
        master_data = json.load(f)
        
    # โหลดไฟล์ตัวรอง (368 KB)
    with open(seed_path, 'r', encoding='utf-8') as f:
        seed_data = json.load(f)
        
    # ดึง chat_history ออกมา
    master_history = master_data.get('chat_history', [])
    seed_history = seed_data.get('chat_history', [])
    
    print(f"  - ประวัติในตัวแม่: {len(master_history)} รายการ")
    print(f"  - ประวัติในตัวรอง: {len(seed_history)} รายการ")
    
    # ใช้เซ็ตหรือเงื่อนไขเช็คความซ้ำ (เทียบจากเวลา time และข้อความ user)
    existing_keys = {(item.get('time'), item.get('user')) for item in master_history}
    
    added_count = 0
    for item in seed_history:
        key = (item.get('time'), item.get('user'))
        if key not in existing_keys:
            master_history.append(item)
            existing_keys.add(key)
            added_count += 1
            
    # อัปเดตรายการที่รวมแล้วกลับเข้าไปใน master_data
    master_data['chat_history'] = master_history
    
    # บันทึกไฟล์ใหม่ที่รวมแล้ว
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(master_data, f, ensure_ascii=False, indent=2)
        
    new_size_kb = os.path.getsize(output_path) / 1024
    print(f"\n✨ รวมสำเร็จเรียบร้อย!")
    print(f"📁 บันทึกไฟล์ที่ผสานแล้วที่: {output_path}")
    print(f"📊 ขนาดไฟล์ใหม่: {new_size_kb:.2f} KB (รวมประวัติทั้งหมด {len(master_history)} รายการ, เพิ่มจากตัวรองมา {added_count} รายการ)")

except Exception as e:
    print(f"❌ เกิดข้อผิดพลาดในการรวมไฟล์: {e}")

