import datetime, fcntl, json, os, tempfile

TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
HOME = os.path.expanduser("~")
OUT_JSON = os.path.join(HOME, "work_new/github_render_clean/new_scripts/old_files_inventory_v1.json")

SEARCH_ROOTS = [
    os.path.join(HOME, "ai_girl_bot"),
    os.path.join(HOME, "work_new"),
    "/storage/emulated/0/Dev",
]
EXTRA_HOME_EXTS = (".py", ".sh", ".json", ".html")

def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lock_path = path + ".lock"
    with open(lock_path, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".inv_old_", suffix=".tmp")
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

found = []
seen_paths = set()

# 1) ค้นหาในโฟลเดอร์หลักที่เก็บโค้ด/บอท/งานเก่า
for root_dir in SEARCH_ROOTS:
    if not os.path.exists(root_dir):
        continue
    for r, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "__pycache__", ".venv", "venv")]
        for fn in sorted(files):
            fp = os.path.join(r, fn)
            if fp in seen_paths:
                continue
            seen_paths.add(fp)
            try:
                st = os.stat(fp)
                found.append({
                    "path": fp,
                    "name": fn,
                    "ext": os.path.splitext(fn)[1].lower(),
                    "bytes": st.st_size,
                    "modified_th_24h": datetime.datetime.fromtimestamp(st.st_mtime, TZ_TH).strftime("%Y-%m-%d %H:%M:%S"),
                    "mtime": st.st_mtime,
                })
            except Exception:
                pass

# 2) ค้นหาไฟล์โค้ด/สคริปต์/json ที่วางอยู่ระดับบนของ HOME (~)
if os.path.exists(HOME):
    for fn in sorted(os.listdir(HOME)):
        fp = os.path.join(HOME, fn)
        if os.path.isfile(fp) and fp not in seen_paths:
            ext = os.path.splitext(fn)[1].lower()
            if ext in EXTRA_HOME_EXTS:
                seen_paths.add(fp)
                try:
                    st = os.stat(fp)
                    found.append({
                        "path": fp,
                        "name": fn,
                        "ext": ext,
                        "bytes": st.st_size,
                        "modified_th_24h": datetime.datetime.fromtimestamp(st.st_mtime, TZ_TH).strftime("%Y-%m-%d %H:%M:%S"),
                        "mtime": st.st_mtime,
                    })
                except Exception:
                    pass

found.sort(key=lambda x: x["mtime"], reverse=True)

by_ext = {}
for item in found:
    ext = item["ext"] or "(no_ext)"
    by_ext[ext] = by_ext.get(ext, 0) + 1

top_dirs = {}
for item in found:
    p = item["path"]
    if p.startswith("/storage/emulated/0/Dev/"):
        parts = p[len("/storage/emulated/0/Dev/"):].split("/")
        grp = "/storage/emulated/0/Dev/" + parts[0]
    elif p.startswith(HOME + "/"):
        rel = p[len(HOME) + 1:]
        grp = HOME + "/" + rel.split("/")[0] if "/" in rel else HOME + "/(top_file)"
    else:
        grp = os.path.dirname(p)
    top_dirs[grp] = top_dirs.get(grp, 0) + 1

report = {
    "scanned_at_th_24h": datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d %H:%M:%S"),
    "admin_agent": "brother_15001",
    "policy": "read_only_search_never_delete_or_modify_old_files",
    "total_files_found": len(found),
    "count_by_ext": by_ext,
    "count_by_group": sorted(top_dirs.items(), key=lambda x: x[1], reverse=True),
    "latest_35_files": [
        {k: v for k, v in item.items() if k != "mtime"} for item in found[:35]
    ],
    "all_files": [
        {k: v for k, v in item.items() if k != "mtime"} for item in found
    ],
}

atomic_write_json(OUT_JSON, report)
print("=== ค้นหาไฟล์ทั้งหมดในเครื่องเสร็จแล้ว (อ่านอย่างเดียว ไม่แตะ/ไม่ลบของเก่า) ===")
print("ไฟล์รายงานฉบับเต็ม:", OUT_JSON)
print("จำนวนไฟล์ที่พบทั้งหมด:", len(found))
print("แยกตามนามสกุล:", by_ext)
print("--- แยกตามโฟลเดอร์หลัก ---")
for grp, cnt in report["count_by_group"][:15]:
    print(f"  {grp}: {cnt} ไฟล์")
print("--- 20 ไฟล์ที่แก้ไขล่าสุด ---")
for item in report["latest_35_files"][:20]:
    print(f"  [{item['modified_th_24h']}] {item['path']} ({item['bytes']} bytes)")
