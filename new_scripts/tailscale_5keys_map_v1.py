import importlib.util, os

BASE_DIR = os.path.expanduser("~/work_new/github_render_clean")
NEW_SCRIPTS_DIR = os.path.join(BASE_DIR, "new_scripts")
K5_PATH = os.path.join(NEW_SCRIPTS_DIR, "ws_family_5keys_v1.py")

EXIT_NODE_VPS = {
    "hostname": "vps3846112",
    "tailscale_ip": "162.35.47.89",
    "os": "linux",
    "offers_exit_node": True,
}

KNOWN_PEERS = {
    "hackers-1": {"ip": "100.124.138.80", "os": "android"},
    "a07--thanyathep": {"ip": "100.86.139.27", "os": "android"},
    "hackers": {"ip": "100.107.9.10", "os": "android"},
}

def _load_k5():
    spec = importlib.util.spec_from_file_location("ws_family_5keys_v1", K5_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def build_five_key_tailscale_plan() -> dict:
    k5 = _load_k5()
    bundle = k5.build_five_keys()
    peer_hints = {
        "แอดมิน": "hackers-1 (100.124.138.80)",
        "แม่": "รอผูกเครื่องแม่ในวง Tailscale",
        "เจตนา": "รอผูกเครื่องเจตนาในวง Tailscale",
        "ธัญเทพ": "a07--thanyathep (100.86.139.27)",
        "ลูกค้าเทสต์": "โหนดทดสอบ (100.107.9.10 หรือเครื่องเทสต์)",
    }
    slots = []
    for name, rec in bundle.items():
        slots.append({
            "slot": rec["slot"],
            "name": name,
            "role": rec["role"],
            "full_access": rec["full_access"],
            "exit_node": EXIT_NODE_VPS["tailscale_ip"],
            "exit_hostname": EXIT_NODE_VPS["hostname"],
            "peer_hint": peer_hints.get(name, "-"),
        })
    return {
        "exit_node": EXIT_NODE_VPS,
        "known_peers": KNOWN_PEERS,
        "slots": slots,
    }
