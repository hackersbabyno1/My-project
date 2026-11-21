import datetime, fcntl, json, os, tempfile, time, urllib.request, urllib.error

TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
HOME = os.path.expanduser("~")
GH_DIR = os.path.join(HOME, "work_new/github_render_clean")
MEM_FILE = os.path.join(GH_DIR, "memory.json")
STATE_FILE = os.path.join(GH_DIR, "new_scripts/twin_auto_bus_v1.json")
LOG_FILE = os.path.join(GH_DIR, "new_scripts/auto_twin_sync_brother_v1.log")

TWIN_HOST = os.environ.get("TWIN_BOT_HOST", "100.70.177.127")
TWIN_PORT = int(os.environ.get("TWIN_BOT_PORT", "25003"))
INTERVAL_SEC = int(os.environ.get("TWIN_SYNC_INTERVAL", "20"))

def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lock_path = path + ".lock"
    with open(lock_path, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".bus_", suffix=".tmp")
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

def read_json_safe(path):
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return json.load(f)
    except Exception:
        return {}

def append_log(msg):
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    ts = datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, "a", encoding="utf-8") as lf:
        lf.write(f"[{ts}] {msg}\n")

def probe_twin():
    for path in ("/health", "/status", "/api/health", "/"):
        url = f"http://{TWIN_HOST}:{TWIN_PORT}{path}"
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=3) as resp:
                body = resp.read(512).decode("utf-8", errors="ignore")
                return {"reachable": True, "endpoint": path, "code": resp.status, "sample": body[:160]}
        except urllib.error.HTTPError as e:
            return {"reachable": True, "endpoint": path, "code": e.code, "sample": str(e)}
        except Exception:
            continue
    return {"reachable": False, "endpoint": None, "code": None, "sample": "no_http_response"}

def main():
    append_log(f"started auto_twin_sync_brother_v1 -> {TWIN_HOST}:{TWIN_PORT} every {INTERVAL_SEC}s")
    while True:
        now_th = datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d %H:%M:%S")
        mem = read_json_safe(MEM_FILE)
        twin_status = probe_twin()
        bus_payload = {
            "updated_at_th_24h": now_th,
            "admin_agent": "brother_15001",
            "twin_target": f"{TWIN_HOST}:{TWIN_PORT}",
            "shared_memory_path": MEM_FILE,
            "shared_memory_bytes": os.path.getsize(MEM_FILE) if os.path.exists(MEM_FILE) else 0,
            "last_unified": mem.get("last_unified") if isinstance(mem, dict) else None,
            "twin_probe": twin_status,
        }
        atomic_write_json(STATE_FILE, bus_payload)
        append_log(f"sync_tick ok | twin_reachable={twin_status['reachable']} | mem_bytes={bus_payload['shared_memory_bytes']}")
        time.sleep(INTERVAL_SEC)

if __name__ == "__main__":
    main()
