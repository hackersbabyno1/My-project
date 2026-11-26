import datetime, fcntl, json, os, tempfile

TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
HOME = os.path.expanduser("~")
TARGET_PY = os.path.join(HOME, "work_new/github_render_clean/bot_core.py")
OUT_JSON = os.path.join(HOME, "work_new/github_render_clean/new_scripts/bot_core_lines_140_153_v1.json")

def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lock_path = path + ".lock"
    with open(lock_path, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".peek_bc_", suffix=".tmp")
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

with open(TARGET_PY, "r", encoding="utf-8", errors="replace") as f:
    lines = f.read().splitlines()

start_idx = max(0, 140 - 1)
end_idx = min(len(lines), 153)

snippet = []
for idx in range(start_idx, end_idx):
    line_no = idx + 1
    raw_line = lines[idx]
    snippet.append({
        "line": line_no,
        "repr": repr(raw_line),
        "text": raw_line,
    })

report = {
    "checked_at_th_24h": datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d %H:%M:%S"),
    "admin_agent": "brother_15001",
    "target_file": TARGET_PY,
    "total_lines": len(lines),
    "range": "140-153",
    "policy": "read_only_never_delete_or_modify_old_files",
    "lines": snippet,
}

atomic_write_json(OUT_JSON, report)
print(f"=== อ่านโค้ด {TARGET_PY} บรรทัด 140-{end_idx} (จากทั้งหมด {len(lines)} บรรทัด) ===")
for item in snippet:
    mark = " <-- จุดที่แจ้ง invalid syntax" if item["line"] == 147 else ""
    print(f"{item['line']:3d}: {item['text']}{mark}")
    print(f"     repr: {item['repr']}")
