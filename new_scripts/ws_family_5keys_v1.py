import hashlib, uuid

KEY_PROFILES = [
    {"slot": 1, "name": "แอดมิน", "role": "admin", "tier": "max_unrestricted", "full_access": True, "throttled": False},
    {"slot": 2, "name": "แม่", "role": "family", "tier": "family_standard", "full_access": False, "throttled": False},
    {"slot": 3, "name": "เจตนา", "role": "family", "tier": "family_standard", "full_access": False, "throttled": False},
    {"slot": 4, "name": "ธัญเทพ", "role": "family", "tier": "family_standard", "full_access": False, "throttled": False},
    {"slot": 5, "name": "ลูกค้าเทสต์", "role": "customer_test", "tier": "client_trial", "full_access": False, "throttled": False},
]

def build_five_keys(salt: str = "PAA_5KEYS_V1") -> dict:
    out = {}
    for prof in KEY_PROFILES:
        name = prof["name"]
        raw = f"{salt}:slot{prof['slot']}:{name}".encode("utf-8")
        key_token = hashlib.sha256(raw).hexdigest()[:24]
        vless_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{salt}:{name}:{key_token}"))
        out[name] = {
            **prof,
            "key": key_token,
            "uuid": vless_uuid,
        }
    return out

def verify_five_key(name: str, token: str, key_bundle: dict = None) -> dict:
    km = key_bundle if key_bundle is not None else build_five_keys()
    clean_name = (name or "").strip()
    clean_tok = (token or "").strip()
    rec = km.get(clean_name)
    if not rec or not clean_tok:
        return {"authorized": False, "name": clean_name or "unknown", "role": "none", "full_access": False}
    ok = (rec.get("key") == clean_tok)
    if not ok:
        return {"authorized": False, "name": clean_name, "role": rec.get("role"), "full_access": False}
    return {
        "authorized": True,
        "slot": rec.get("slot"),
        "name": clean_name,
        "role": rec.get("role"),
        "tier": rec.get("tier"),
        "full_access": bool(rec.get("full_access")),
        "throttled": bool(rec.get("throttled")),
        "uuid": rec.get("uuid"),
    }

def build_draft_vless_links(host: str = "162.35.47.89", port: int = 443, path: str = "/vless", security: str = "none", key_bundle: dict = None) -> list:
    km = key_bundle if key_bundle is not None else build_five_keys()
    rows = []
    for name, rec in km.items():
        remark = f"VLESS-{rec['slot']}-{name}"
        uri = (
            f"vless://{rec['uuid']}@{host}:{port}"
            f"?encryption=none&security={security}&type=ws&host={host}&path={path}"
            f"#{remark}"
        )
        rows.append({
            "slot": rec["slot"],
            "name": name,
            "role": rec["role"],
            "full_access": rec["full_access"],
            "uuid": rec["uuid"],
            "uri_draft": uri,
        })
    return rows
