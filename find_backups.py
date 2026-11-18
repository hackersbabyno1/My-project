import os

print("=== 🔍 ค้นหาไฟล์ Backup และไฟล์สำรองของบอททั้งหมดในเครื่อง ===")
search_dirs = [
    "/storage/emulated/0/Dev",
    os.path.expanduser("~")
]

backup_keywords = ["backup", "bak", "archive", "zip", "tar"]

found = 0
for base in search_dirs:
    if os.path.exists(base):
        for root, dirs, files in os.walk(base):
            # ข้ามโฟลเดอร์ที่ไม่จำเป็น
            if "site-packages" in root or ".cache" in root or "usr" in root:
                continue
            for f in files:
                lower = f.lower()
                if any(kw in lower for kw in backup_keywords) or lower.endswith(".json"):
                    full_p = os.path.join(root, f)
                    try:
                        size_kb = os.path.getsize(full_p) / 1024
                        print(f"📦 [{size_kb:.2f} KB] {full_p}")
                        found += 1
                    except:
                        pass

print(f"\n✨ สแกนเจอไฟล์สำรอง/ข้อมูลที่เกี่ยวข้องทั้งหมด {found} ไฟล์")
