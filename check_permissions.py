import os
import stat

files_to_check = [
    "/storage/emulated/0/Dev/admin0/admin/memory_backup.json",
    "/storage/emulated/0/Dev/seed_ch2_ok/MASTER_MEMORY_420KB.json"
]

print("=== 🔐 ตรวจสอบสิทธิ์ไฟล์ความจำ ===")
for path in files_to_check:
    print(f"\n📁 ไฟล์: {path}")
    if os.path.exists(path):
        st = os.stat(path)
        mode = st.st_mode
        
        # แปลงสิทธิ์เป็นตัวเลข Octal (เช่น 644, 755)
        octal_perm = oct(stat.S_IMODE(mode))
        
        # ตรวจสอบสิทธิ์การอ่าน เขียน ประมวลผล ของ Owner, Group, Others
        readable = bool(mode & stat.S_IRUSR)
        writable = bool(mode & stat.S_IWUSR)
        executable = bool(mode & stat.S_IXUSR)
        
        print(f"  - สิทธิ์แบบเลข (Octal): {octal_perm}")
        print(f"  - เจ้าของเขียนได้ (Writable): {'✅ ได้'  if writable else '❌ ไม่ได้ (ล็อกไว้)'}")
        print(f"  - เจ้าของอ่านได้ (Readable): {'✅ ได้' if readable else '❌ ไม่ได้'}")
        print(f"  - ขนาดไฟล์: {os.path.getsize(path) / 1024:.2f} KB")
    else:
        print("  ❌ ไม่พบไฟล์นี้ในระบบ")

