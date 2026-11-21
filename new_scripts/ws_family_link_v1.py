import importlib.util, json, os

BASE_DIR = os.path.expanduser("~/work_new/github_render_clean")
NEW_SCRIPTS_DIR = os.path.join(BASE_DIR, "new_scripts")
HUB_PATH = os.path.join(NEW_SCRIPTS_DIR, "ws_family_hub_v1.py")
PROTO_PATH = os.path.join(NEW_SCRIPTS_DIR, "ws_proto_v1.py")

def _load_mod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def send_family_ws_event(host: str, port: int, member: str, token: str, action: str = "net_session", payload=None, key_map=None, timeout: float = 4.0):
    hub = _load_mod("ws_family_hub_v1", HUB_PATH)
    proto = _load_mod("ws_proto_v1", PROTO_PATH)
    km = key_map if key_map is not None else hub.build_member_keys()
    ev = hub.build_ws_event(member, token, action, payload or {}, km)
    raw_reply = proto.ws_client_exchange(host, port, json.dumps(ev, ensure_ascii=False), timeout=timeout)
    try:
        parsed = json.loads(raw_reply) if raw_reply else {}
    except Exception:
        parsed = {"raw": raw_reply}
    return {"event": ev, "reply": parsed}
