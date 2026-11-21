import importlib.util, json, os, urllib.request

BASE_DIR = os.path.expanduser("~/work_new/github_render_clean")
NEW_SCRIPTS_DIR = os.path.join(BASE_DIR, "new_scripts")
K5_PATH = os.path.join(NEW_SCRIPTS_DIR, "ws_family_5keys_v1.py")
SES_JSON_PATH = os.path.join(NEW_SCRIPTS_DIR, "ws_family_sessions_v1.json")

def _load_k5():
    spec = importlib.util.spec_from_file_location("ws_family_5keys_v1", K5_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def _http_ok(url: str, timeout: float = 2.5) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status == 200
    except Exception:
        return False

def get_combined_summary() -> dict:
    k5 = _load_k5()
    bundle = k5.build_five_keys()

    sessions = {"members": {}, "updated_at_th": None, "recent_count": 0}
    if os.path.exists(SES_JSON_PATH):
        try:
            with open(SES_JSON_PATH, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if isinstance(raw, dict):
                sessions["members"] = raw.get("members") if isinstance(raw.get("members"), dict) else {}
                sessions["updated_at_th"] = raw.get("updated_at_th")
                rec = raw.get("recent_events")
                sessions["recent_count"] = len(rec) if isinstance(rec, list) else 0
        except Exception:
            pass

    rows = []
    for name, info in bundle.items():
        m_stat = sessions["members"].get(name, {})
        rows.append({
            "slot": info["slot"],
            "name": name,
            "role": info["role"],
            "full_access": info["full_access"],
            "ok_count": int(m_stat.get("ok_count", 0)),
            "denied_count": int(m_stat.get("denied_count", 0)),
            "last_seen": m_stat.get("last_seen"),
            "last_action": m_stat.get("last_action"),
        })

    return {
        "bot_15001_ok": _http_ok("http://127.0.0.1:15001/healthz"),
        "vps_25003_ok": _http_ok("http://100.70.177.127:25003/status"),
        "sessions_updated_at_th": sessions["updated_at_th"],
        "recent_events_count": sessions["recent_count"],
        "slots": rows,
    }
