import datetime, fcntl, json, os, tempfile

TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
HOME = os.path.expanduser("~")
GH_DIR = os.path.join(HOME, "work_new/github_render_clean")
MEM_PATH = os.path.join(GH_DIR, "memory.json")
OUT_PATH = os.path.join(GH_DIR, "new_scripts/new_items_report_v1.json")

def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lock_path = path + ".lock"
    with open(lock_path, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".diff_new_", suffix=".tmp")
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

with open(MEM_PATH, "r", encoding="utf-8", errors="ignore") as f:
    mem = json.load(f)

keywords = ("กิตติธัช", "kittithat", "unified", "merge", "รวม", "ใหม่", "2026-11-18")
matches = []

def scan_obj(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            scan_obj(v, f"{path}.{k}" if path else str(k))
    elif isinstance(obj, list):
        for idx, item in enumerate(obj):
            scan_obj(item, f"{path}[{idx}]")
    else:
        s = str(obj)
        low = s.lower()
        if any(kw.lower() in low for kw in keywords):
            matches.append({"path": path, "snippet": s[:220]})

scan_obj(mem)

tail_items = {}
for k in ("history", "chat_history", "termux_code_files", "termux_commands", "workspace_logs"):
    v = mem.get(k)
    if isinstance(v, list) and v:
        tail_items[k] = v[-5:]

report = {
    "checked_at_th_24h": datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d %H:%M:%S"),
    "policy": "never_delete_old_code_create_new_files_only",
    "meta": {k: v for k, v in mem.items() if not isinstance(v, (list, dict))},
    "keyword_hits_count": len(matches),
    "keyword_hits_sample": matches[:25],
    "last_5_per_section": tail_items,
}

atomic_write_json(OUT_PATH, report)
print("=== รายการที่พบคำสำคัญ/ของใหม่ใน memory.json (ไม่ลบของเก่า) ===")
print("เมตาข้อมูล:", report["meta"])
print("จำนวนจุดที่ตรงคำสำคัญ:", len(matches))
for m in matches[:15]:
    print(f"  - [{m['path']}]: {m['snippet']}")
print("--- 5 รายการท้ายสุดของ chat_history ---")
for x in tail_items.get("chat_history", []):
    print(" ", json.dumps(x, ensure_ascii=False)[:200])
print("--- 5 รายการท้ายสุดของ termux_code_files ---")
for x in tail_items.get("termux_code_files", []):
    if isinstance(x, dict):
        print(" ", x.get("file"), "| lines:", x.get("lines"), "| path:", x.get("path"))
    else:
        print(" ", str(x)[:160])
