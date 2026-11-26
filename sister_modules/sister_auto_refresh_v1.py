import os, sys, json, time, subprocess
from datetime import datetime, timezone

AUTO_REFRESH_SEC = int(os.environ.get("SISTER_AUTO_REFRESH_SEC", "600"))
STATE_FILE = "/root/work_new/logs_live/sister_airplane_refresh_state.json"
LOG_FILE = "/root/work_new/logs_live/sister_airplane_refresh.log"

def protected_ports_active():
    r = subprocess.run(["ss", "-tulpn"], text=True, capture_output=True)
    out = r.stdout or ""
    return [p for p in (18080, 18081) if f":{p}" in out]

def perform_airplane_refresh(reason="auto_mode"):
    now_iso = datetime.now(timezone.utc).isoformat()
    busy_ports = protected_ports_active()
    actions = []

    for svc in ("xray", "v2ray", "sing-box"):
        chk = subprocess.run(["systemctl", "is-active", svc], text=True, capture_output=True)
        if chk.returncode == 0 and chk.stdout.strip() == "active":
            rst = subprocess.run(["systemctl", "restart", svc], text=True, capture_output=True)
            actions.append({"service": svc, "restarted": (rst.returncode == 0)})

    bot_target = "/root/work_new/bot_02_debian/test_render_v1/bot_core_render_v1.py"
    if os.path.isfile(bot_target):
        subprocess.run(["pkill", "-HUP", "-f", bot_target], text=True, capture_output=True)
        actions.append({"target": os.path.basename(bot_target), "signaled": "HUP"})

    state = {
        "ok": True,
        "engine": "sister_vps_airplane_refresh",
        "mode": reason,
        "interval_sec": AUTO_REFRESH_SEC,
        "last_refresh_utc": now_iso,
        "protected_ports_untouched": busy_ports,
        "actions_executed": actions,
    }

    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

    with open(LOG_FILE, "a", encoding="utf-8") as lf:
        lf.write(f"[{now_iso}] mode={reason} actions={len(actions)} protected={busy_ports}\n")

    return state

def run_daemon():
    while True:
        try:
            perform_airplane_refresh("auto_loop")
        except Exception as e:
            with open(LOG_FILE, "a", encoding="utf-8") as lf:
                lf.write(f"[{datetime.now(timezone.utc).isoformat()}] ERROR: {e}\n")
        time.sleep(AUTO_REFRESH_SEC)

if __name__ == "__main__":
    if "--daemon" in sys.argv:
        run_daemon()
    elif "--now" in sys.argv:
        print(json.dumps(perform_airplane_refresh("manual_trigger"), ensure_ascii=False, indent=2))
    else:
        print(json.dumps(perform_airplane_refresh("initial_run"), ensure_ascii=False, indent=2))
