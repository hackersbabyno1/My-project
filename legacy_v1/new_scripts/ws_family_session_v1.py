import datetime, fcntl, importlib.util, json, os, tempfile

TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
BASE_DIR = os.path.expanduser("~/work_new/github_render_clean")
NEW_SCRIPTS_DIR = os.path.join(BASE_DIR, "new_scripts")
HUB_PATH = os.path.join(NEW_SCRIPTS_DIR, "ws_family_hub_v1.py")
SESSION_LOG_PATH = os.path.join(NEW_SCRIPTS_DIR, "ws_family_sessions_v1.json")

def _load_hub():
    spec = importlib.util.spec_from_file_location("ws_family_hub_v1", HUB_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def _atomic_write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lock_path = path + ".lock"
    with open(lock_path, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".wss_", suffix=".tmp")
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

def record_family_session(member: str, token: str, action: str = "net_session", payload=None, key_map=None, session_path=SESSION_LOG_PATH):
    hub = _load_hub()
    km = key_map if key_map is not None else hub.build_member_keys()
    ev = hub.build_ws_event(member, token, action, payload or {}, km)
    ev["time_th"] = datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d %H:%M:%S")

    current = {"members": {}, "recent_events": []}
    if os.path.exists(session_path):
        try:
            with open(session_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict):
                    current["members"] = loaded.get("members") if isinstance(loaded.get("members"), dict) else {}
                    current["recent_events"] = loaded.get("recent_events") if isinstance(loaded.get("recent_events"), list) else []
        except Exception:
            pass

    m_name = ev["member"]
    m_rec = current["members"].get(m_name, {"ok_count": 0, "denied_count": 0, "last_seen": None, "last_action": None})
    if ev["authorized"]:
        m_rec["ok_count"] = int(m_rec.get("ok_count", 0)) + 1
    else:
        m_rec["denied_count"] = int(m_rec.get("denied_count", 0)) + 1
    m_rec["last_seen"] = ev["time_th"]
    m_rec["last_action"] = ev["action"]
    current["members"][m_name] = m_rec

    current["recent_events"].append(ev)
    current["recent_events"] = current["recent_events"][-100:]
    current["updated_at_th"] = ev["time_th"]

    _atomic_write(session_path, current)
    return ev
