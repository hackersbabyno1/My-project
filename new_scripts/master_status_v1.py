import importlib.util, os

BASE_DIR = os.path.expanduser("~/work_new/github_render_clean")
NEW_SCRIPTS_DIR = os.path.join(BASE_DIR, "new_scripts")

def _load_mod(name: str, filename: str):
    p = os.path.join(NEW_SCRIPTS_DIR, filename)
    spec = importlib.util.spec_from_file_location(name, p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def get_master_status() -> dict:
    ov = _load_mod("family_overview_v1", "family_overview_v1.py")
    ts = _load_mod("tailscale_5keys_map_v1", "tailscale_5keys_map_v1.py")

    summary = ov.get_combined_summary()
    plan = ts.build_five_key_tailscale_plan()
    peer_by_name = {s["name"]: s["peer_hint"] for s in plan.get("slots", [])}

    merged_slots = []
    for row in summary.get("slots", []):
        name = row["name"]
        merged_slots.append({
            **row,
            "exit_node": plan["exit_node"]["tailscale_ip"],
            "peer_hint": peer_by_name.get(name, "-"),
        })

    return {
        "bot_15001_ok": summary.get("bot_15001_ok"),
        "vps_25003_ok": summary.get("vps_25003_ok"),
        "exit_node": plan["exit_node"],
        "sessions_updated_at_th": summary.get("sessions_updated_at_th"),
        "recent_events_count": summary.get("recent_events_count"),
        "slots": merged_slots,
    }
