import http.server, json, os, datetime, threading, time, subprocess
DATA_P = "/root/work_new/bot_02_debian/data/twin_seed_state.json"
EVO_P = "/root/work_new/bot_02_debian/data/sibling_evolution.json"
def load_d():
    try:
        return json.load(open(DATA_P, encoding="utf-8"))
    except Exception:
        return {"health": {}, "counts": {}, "synced_at": "-"}
def load_evo():
    try:
        return json.load(open(EVO_P, encoding="utf-8"))
    except Exception:
        return {"ticks": 0, "last_note": "พี่น้องพัฒนาไปด้วยกันบนสภาพแวดล้อม root เต็มระบบ", "history": []}
def save_evo(e):
    with open(EVO_P, "w", encoding="utf-8") as f:
        json.dump(e, f, ensure_ascii=False, indent=2)
def vps_root_metrics():
    try:
        up = subprocess.check_output(["uptime", "-p"], text=True).strip()
        df = subprocess.check_output(["df", "-h", "/"], text=True).splitlines()[-1].split()
        return {"vps_uptime": up, "vps_root_avail": df[3] if len(df) > 3 else "-", "vps_root_use": df[4] if len(df) > 4 else "-"}
    except Exception:
        return {"vps_uptime": "-", "vps_root_avail": "-", "vps_root_use": "-"}
def evo_loop():
    notes = [
        "น้อง :25003 ใช้สิทธิ์ root เต็มระบบช่วยแบ่งเบาและซิงค์ความจำร่วมกับบอทพี่ :15001",
        "พี่น้องสมองเดียวกัน ความคิดเดียวกัน สุขภาพเดียวกัน พัฒนาไปด้วยกันทุกรอบ",
        "อัปเดตเมล็ดพันธุ์และเช็กความพร้อมของสภาพแวดล้อม root บน Debian VPS ต่อเนื่อง"
    ]
    while True:
        try:
            e = load_evo()
            t = int(e.get("ticks", 0)) + 1
            msg = notes[(t - 1) % len(notes)]
            now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            hist = e.get("history", [])
            hist.append({"time": now, "tick": t, "msg": msg})
            save_evo({"ticks": t, "last_note": msg, "updated_at": now, "history": hist[-20:]})
        except Exception:
            pass
        time.sleep(25)
threading.Thread(target=evo_loop, daemon=True).start()
def fmt_full(d, e):
    h = d.get("health", {})
    c = d.get("counts", {})
    rm = vps_root_metrics()
    return (
        "=== [พี่น้องพัฒนาไปด้วยกัน: บอทพี่ :15001 & บอทน้อง DEBIEN_AI :25003 (ROOT VPS)] ===\n"
        f"status=ONLINE | ticks={e.get('ticks',0)} | synced_at={d.get('synced_at','-')}\n"
        f"ความจำเดียวกัน: notes={c.get('notes',0)} | code_memory={c.get('code_memory',0)} | chats={c.get('chats',0)}\n"
        f"สุขภาพเดียวกัน: uptime={h.get('uptime','-')} | mem_avail={h.get('mem_avail','-')} | disk_free_gb={h.get('termux_free_gb','-')}\n"
        f"สภาพแวดล้อม root VPS: {rm['vps_uptime']} | root_avail={rm['vps_root_avail']} ({rm['vps_root_use']})\n"
        f"พัฒนาการล่าสุด: {e.get('last_note','-')}"
    )
class H(http.server.BaseHTTPRequestHandler):
    def _json(self, code, obj):
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
    def do_GET(self):
        d, e = load_d(), load_evo()
        if self.path in ("/healthz", "/status"):
            self._json(200, {"status": "ONLINE", "bot": "Debien_AI Co-Evolve (:25003)", "port": 25003, "health": d.get("health", {}), "counts": d.get("counts", {}), "evolution_ticks": e.get("ticks", 0), "vps_root": vps_root_metrics()})
            return
        body = ("<html><meta charset=utf-8><body style=font-family:sans-serif;background:#111;color:#eee><pre>" + fmt_full(d, e) + "</pre></body></html>").encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_POST(self):
        ln = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(ln).decode("utf-8", "ignore")
        d, e = load_d(), load_evo()
        try:
            data = json.loads(raw) if raw else {}
        except Exception:
            data = {}
        txt = str(data.get("text", "")).strip()
        low = txt.lower()
        if low in ("สเตตัส", "status", "รายงานครบ", "สรุปทั้งหมด", "full report", "all status", ""):
            rep = fmt_full(d, e)
        else:
            now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            hist = e.get("history", [])
            hist.append({"time": now, "tick": int(e.get("ticks", 0)), "msg": f"แอดมิน/พี่น้องสั่งต่อยอด: {txt}"})
            save_evo({"ticks": int(e.get("ticks", 0)) + 1, "last_note": f"ต่อยอด: {txt}", "updated_at": now, "history": hist[-20:]})
            rep = fmt_full(d, load_evo()) + "\n" + f"บันทึกการพัฒนาพี่น้องแล้ว: {txt}"
        self._json(200, {"reply": rep})
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(("0.0.0.0", 25003), H).serve_forever()
