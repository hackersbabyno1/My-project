import hashlib, json, os, time

DEFAULT_MEMBERS = ["ป๋า", "ธัญเทพ", "เจตนา", "แม่"]

def build_member_keys(members=None, salt="WS_FAMILY_HUB_V1"):
    names = members or DEFAULT_MEMBERS
    keys = {}
    for name in names:
        raw = f"{salt}:{name}".encode("utf-8")
        keys[name] = hashlib.sha256(raw).hexdigest()[:20]
    return keys

def verify_member_key(member: str, token: str, key_map: dict) -> bool:
    expected = (key_map or {}).get((member or "").strip())
    provided = (token or "").strip()
    if not expected or not provided:
        return False
    return expected == provided

def build_ws_event(member: str, token: str, action: str, payload: dict, key_map: dict) -> dict:
    ts = int(time.time())
    m = (member or "").strip()
    allowed = verify_member_key(m, token, key_map)
    return {
        "ts": ts,
        "member": m or "unknown",
        "authorized": allowed,
        "action": (action or "ping").strip(),
        "payload": payload if isinstance(payload, dict) else {"value": payload},
    }
