import datetime, fcntl, json, os, tempfile

TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
HOME = os.path.expanduser("~")
GH_DIR = os.path.join(HOME, "work_new/github_render_clean")
MEM_PATH = os.path.join(GH_DIR, "memory.json")
OUT_PATH = os.path.join(GH_DIR, "new_scripts/memory_kittithat_summary_v1.json")

def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lock_path = path + ".lock"
    with open(lock_path, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".mem_sum_", suffix=".tmp")
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

summary = {
    "checked_at_th_24h": datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d %H:%M:%S"),
    "policy": "never_delete_old_code_create_new_files_only",
    "user_name": mem.get("user_name"),
    "birth_date": mem.get("birth_date"),
    "version": mem.get("version"),
    "last_unified": mem.get("last_unified"),
    "total_memories": mem.get("total_memories"),
    "section_counts": {},
    "latest_samples": {},
}

for k, v in mem.items():
    if isinstance(v, list):
        summary["section_counts"][k] = len(v)
        summary["latest_samples"][k] = v[-2:] if v else []
    elif isinstance(v, dict):
        summary["section_counts"][k] = len(v)
        summary["latest_samples"][k] = list(v.items())[-2:] if v else []

atomic_write_json(OUT_PATH, summary)
print("=== สรุปไส้ใน memory.json (ไม่ลบของเก่า) ===")
print("user_name:", summary["user_name"], "| version:", summary["version"])
print("last_unified:", summary["last_unified"], "| total_memories:", summary["total_memories"])
print("--- จำนวนรายการในแต่ละหมวด ---")
for k, cnt in summary["section_counts"].items():
    print(f"  {k}: {cnt}")
print("--- ตัวอย่างข้อมูลล่าสุดบางหมวด ---")
for k in ("history", "chat_history", "termux_code_files", "workspace_logs", "health_logs"):
    if k in summary["latest_samples"] and summary["latest_samples"][k]:
        txt = json.dumps(summary["latest_samples"][k], ensure_ascii=False)
        print(f"  [{k}]: {txt[:240]}")
