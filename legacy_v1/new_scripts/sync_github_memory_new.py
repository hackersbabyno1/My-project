import datetime, fcntl, glob, json, os, tempfile

TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
HOME = os.path.expanduser("~")
GH_DIR = os.path.join(HOME, "work_new/github_render_clean")
WORK_NEW = os.path.join(HOME, "work_new")
OUT_JSON = os.path.join(GH_DIR, "new_scripts/github_memory_sync_v1.json")

def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lock_path = path + ".lock"
    with open(lock_path, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".m_new_", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as tf:
                json.dump(data, tf, ensure_ascii=False, indent=2)
            os.replace(tmp_path, path)
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
            fcntl.flock(lf.fileno(), fcntl.LOCK_UN)

def safe_read_json(path):
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return json.load(f)
    except Exception:
        return None

gh_files = []
for root, dirs, files in os.walk(GH_DIR):
    dirs[:] = [d for d in dirs if d != ".git"]
    for fn in sorted(files):
        fp = os.path.join(root, fn)
        rel = os.path.relpath(fp, GH_DIR)
        try:
            sz = os.path.getsize(fp)
        except Exception:
            sz = 0
        gh_files.append({"path": rel, "bytes": sz})

mem_path = os.path.join(GH_DIR, "memory.json")
mem_data = safe_read_json(mem_path) if os.path.exists(mem_path) else None
code_files = [x["path"] for x in gh_files if x["path"].endswith((".py", ".sh"))]

new_zone_jsons = []
for fp in sorted(glob.glob(os.path.join(WORK_NEW, "**", "*.json"), recursive=True)):
    if "/.git/" in fp or fp == OUT_JSON:
        continue
    new_zone_jsons.append(os.path.relpath(fp, HOME))

result = {
    "created_at_th_24h": datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d %H:%M:%S"),
    "policy": "never_delete_old_code_create_new_files_only",
    "repo_dir": GH_DIR,
    "github_files_total": len(gh_files),
    "github_code_files": code_files,
    "memory_json_type": type(mem_data).__name__ if mem_data is not None else "missing_or_non_json",
    "memory_json_summary": (
        list(mem_data.keys())[:25] if isinstance(mem_data, dict)
        else (len(mem_data) if isinstance(mem_data, list) else 0)
    ),
    "work_new_json_files": new_zone_jsons,
    "pending_display_polish": [
        "หน้าจอ 25 แถวของบอทพี่ (โดยเฉพาะแถวที่ 23) รอกลับมาแก้ทีหลังตามคำสั่ง"
    ],
}

atomic_write_json(OUT_JSON, result)
print("=== สร้างไฟล์ใหม่และซิงค์ความจำกับ GitHub สำเร็จ (ไม่ลบของเก่า) ===")
print("สคริปต์ใหม่:", __file__)
print("ไฟล์ผลลัพธ์ใหม่:", OUT_JSON)
print("จำนวนไฟล์ใน repo:", len(gh_files))
print("ไฟล์โค้ดใน repo:", code_files)
print("ชนิดข้อมูล memory.json:", result["memory_json_type"], "| รายการ/จำนวน:", result["memory_json_summary"])
