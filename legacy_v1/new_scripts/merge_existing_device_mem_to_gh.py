import datetime, fcntl, glob, json, os, tempfile

TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
HOME = os.path.expanduser("~")
GH_MEM_PATH = os.path.join(HOME, "work_new/github_render_clean/memory.json")

def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lock_path = path + ".lock"
    with open(lock_path, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".gh_mem_", suffix=".tmp")
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

# ค้นหาไฟล์ memory.json ที่มีอยู่จริงในเครื่อง (ยกเว้นตัวที่อยู่ใน github_render_clean เอง)
found_files = []
for root_dir in [
    os.path.join(HOME, "work_new"),
    os.path.join(HOME, "ai_girl_bot"),
    "/storage/emulated/0/Dev",
]:
    if not os.path.exists(root_dir):
        continue
    for fp in glob.glob(os.path.join(root_dir, "**", "memory.json"), recursive=True):
        if os.path.abspath(fp) == os.path.abspath(GH_MEM_PATH):
            continue
        if "/.git/" in fp:
            continue
        try:
            st = os.stat(fp)
            data = safe_read_json(fp)
            if isinstance(data, dict):
                found_files.append((st.st_mtime, st.st_size, fp, data))
        except Exception:
            pass

found_files.sort(key=lambda x: x[0], reverse=True)

gh_data = safe_read_json(GH_MEM_PATH)
if not isinstance(gh_data, dict):
    gh_data = {}

merged_count_by_key = {}
for mtime, sz, fp, dev_data in found_files:
    for k, v in dev_data.items():
        if isinstance(v, list):
            cur = gh_data.get(k)
            if not isinstance(cur, list):
                cur = [] if cur is None else [cur]
            seen = set()
            for item in cur:
                seen.add(json.dumps(item, ensure_ascii=False, sort_keys=True) if isinstance(item, (dict, list)) else str(item))
            added = 0
            for item in v:
                sig = json.dumps(item, ensure_ascii=False, sort_keys=True) if isinstance(item, (dict, list)) else str(item)
                if sig not in seen:
                    cur.append(item)
                    seen.add(sig)
                    added += 1
            gh_data[k] = cur
            merged_count_by_key[k] = merged_count_by_key.get(k, 0) + added
        elif isinstance(v, dict):
            cur = gh_data.get(k)
            if not isinstance(cur, dict):
                cur = {}
            before_len = len(cur)
            for dk, dv in v.items():
                if dk not in cur or not cur[dk]:
                    cur[dk] = dv
            gh_data[k] = cur
            merged_count_by_key[k] = merged_count_by_key.get(k, 0) + max(0, len(cur) - before_len)
        else:
            if v not in (None, "") and (k not in gh_data or not gh_data[k]):
                gh_data[k] = v

now_th = datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d %H:%M:%S")
gh_data["last_unified"] = now_th
gh_data["admin_agent"] = "brother_15001"
gh_data["merged_device_memory_files"] = [
    {
        "path": fp,
        "bytes": sz,
        "modified_th_24h": datetime.datetime.fromtimestamp(mt, TZ_TH).strftime("%Y-%m-%d %H:%M:%S"),
    }
    for mt, sz, fp, _ in found_files
]

atomic_write_json(GH_MEM_PATH, gh_data)
print("=== เอาความจำที่มีอยู่จริงในเครื่อง มารวมเข้ากับ GitHub สำเร็จ ===")
print("ไฟล์ปลายทาง:", GH_MEM_PATH)
print("ไฟล์ความจำเดิมในเครื่องที่เจอและดึงมารวม:", len(found_files))
for mt, sz, fp, _ in found_files:
    print(f"  - [{datetime.datetime.fromtimestamp(mt, TZ_TH).strftime('%Y-%m-%d %H:%M:%S')}] {fp} ({sz} bytes)")
print("จำนวนรายการใหม่ที่เติมเพิ่มเข้าแต่ละหมวด:", merged_count_by_key)
print("อัปเดต last_unified เป็น:", now_th)
