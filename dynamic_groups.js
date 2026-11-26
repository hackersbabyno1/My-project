const fs = require("fs");
const cp = require("child_process");
const crypto = require("crypto");
const GROUPS_FILE = "/root/work_new/bot_02_debian/custom_groups.json";
const UI_FILE = "/root/work_new/bot_02_debian/dynamic_ui.js";

const CORE_ZONES = [
  { id: "admin_free", name: "โซนแอดมินอิสระ (ไม่จำกัด · 10 โปรโตคอล)", defaultDays: 0, unlimited: true },
  { id: "family",     name: "กลุ่มครอบครัว (ใช้งานฟรี)", defaultDays: 30, unlimited: false },
  { id: "test",       name: "กลุ่มเทสต์ (แจกฟรีผู้ร่วมทดสอบ · ชม./วัน)", defaultDays: 1, unlimited: false },
  { id: "general",    name: "กลุ่มทั่วไป (ใช้งานจริง · จ่ายเงินแล้ว)", defaultDays: 30, unlimited: false }
];

function loadCustomGroups() {
  try {
    const d = JSON.parse(fs.readFileSync(GROUPS_FILE, "utf8"));
    return Array.isArray(d) ? d : [];
  } catch (e) { return []; }
}
function saveCustomGroups(g) {
  fs.writeFileSync(GROUPS_FILE, JSON.stringify(g, null, 2), "utf8");
}
function syncXray() {
  const py = [
    "import json, subprocess, time",
    "now_ms = int(time.time() * 1000)",
    "ks = json.load(open('/root/work_new/bot_02_debian/keys_store.json'))",
    "act = []",
    "for k in ks.get('keys', []):",
    "    if not k.get('uuid') or not k.get('active', True): continue",
    "    exp = int(k.get('expiresAt') or 0)",
    "    if int(k.get('id', 0)) != 1 and exp > 0 and exp <= now_ms: continue",
    "    act.append((k.get('uuid'), k.get('name', 'client')))",
    "ids = {u for u, _ in act}",
    "p = '/usr/local/etc/xray/config.json'",
    "d = json.load(open(p))",
    "for ib in d.get('inbounds', []):",
    "    if ib.get('port') in (443, 444):",
    "        cl = ib.setdefault('settings', {}).setdefault('clients', [])",
    "        kept = [c for c in cl if c.get('email') in ('ป๋า (Master)', 'Master Admin') or c.get('id') in ids]",
    "        have = {c.get('id') for c in kept}",
    "        for u, nm in act:",
    "            if u not in have:",
    "                r = {'id': u, 'email': nm}",
    "                if ib.get('protocol') == 'vmess': r['alterId'] = 0",
    "                kept.append(r); have.add(u)",
    "        ib['settings']['clients'] = kept",
    "json.dump(d, open(p, 'w'), indent=2, ensure_ascii=False)",
    "subprocess.run('systemctl restart xray 2>/dev/null || service xray restart 2>/dev/null || pkill -HUP xray 2>/dev/null', shell=True)"
  ].join("\n");
  cp.exec("python3 -c " + JSON.stringify(py), () => {});
}
function readBody(req, cb) {
  let b = "";
  req.on("data", c => b += c);
  req.on("end", () => { try { cb(JSON.parse(b || "{}")); } catch (e) { cb({}); } });
}
function jsonRes(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}
function normalizeZone(g) {
  const s = String(g || "").trim();
  if (s === "admin_free" || s === "family" || s === "test" || s === "general") return s;
  return "admin_free";
}

module.exports = function handleDynamic(req, res, pathname, isAdmin, KEYS, saveKeys) {
  if (pathname === "/dynamic-ui.js") {
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(fs.existsSync(UI_FILE) ? fs.readFileSync(UI_FILE, "utf8") : "");
  }
  if (!pathname.startsWith("/api/dynamic-")) return false;
  if (!isAdmin) { jsonRes(res, 401, { ok: false, error: "Unauthorized" }); return true; }

  if (pathname === "/api/dynamic-data") {
    const keys = Array.isArray(KEYS) ? KEYS.filter(k => k && Number(k.id) !== 1) : [];
    const customGroups = loadCustomGroups();
    jsonRes(res, 200, {
      ok: true,
      now: Date.now(),
      host: (req.headers.host || "162.35.47.89").split(":")[0],
      zones: CORE_ZONES,
      customGroups,
      keys
    });
    return true;
  }

  if (pathname === "/api/dynamic-key/create" && req.method === "POST") {
    readBody(req, d => {
      const zone = normalizeZone(d.groupId || d.zone);
      const proto = String(d.proto || "VLESS").trim() || "VLESS";
      const isUnlimited = !!d.unlimited;
      const unit = d.unit === "hours" ? "hours" : "days";
      const rawVal = Math.max(1, Number(d.amount || d.days || 1));
      const durationHours = isUnlimited ? 0 : (unit === "hours" ? rawVal : rawVal * 24);
      const durationDays = isUnlimited ? 0 : (unit === "hours" ? Math.max(1, Math.ceil(rawVal / 24)) : rawVal);

      const nextId = (Array.isArray(KEYS) ? KEYS.reduce((m, k) => Math.max(m, Number(k && k.id) || 0), 1) : 1) + 1;
      const baseName = String(d.name || "").trim() || (zone + "-" + nextId);
      const displayName = baseName.startsWith("[") ? baseName : ("[" + proto + "] " + baseName);

      const item = {
        id: nextId,
        name: displayName,
        proto,
        group: zone,
        paid: zone === "general",
        unlimited: isUnlimited,
        durationUnit: isUnlimited ? "unlimited" : unit,
        durationHours,
        durationDays,
        uuid: crypto.randomUUID(),
        active: true,
        started: false,
        activatedAt: 0,
        expiresAt: 0,
        lastSeenAt: 0,
        activeSessionStart: 0
      };
      if (Array.isArray(KEYS)) KEYS.push(item);
      if (typeof saveKeys === "function") saveKeys();
      syncXray();
      jsonRes(res, 200, { ok: true, key: item });
    });
    return true;
  }

  if (pathname === "/api/dynamic-key/time" && req.method === "POST") {
    readBody(req, d => {
      const id = Number(d.id || 0);
      const target = Array.isArray(KEYS) ? KEYS.find(k => k && Number(k.id) === id) : null;
      if (!target || id === 1) return jsonRes(res, 404, { ok: false, error: "ไม่พบคีย์" });

      const zone = normalizeZone(target.group);
      if (d.unlimited === true) {
        if (zone !== "admin_free" && zone !== "family") {
          return jsonRes(res, 400, { ok: false, error: "โหมดไม่จำกัดใช้ได้เฉพาะแอดมินและครอบครัว" });
        }
        target.unlimited = true;
        target.durationUnit = "unlimited";
        target.durationHours = 0;
        target.durationDays = 0;
        target.expiresAt = 0;
        target.active = true;
      } else {
        const unit = (zone === "test" || zone === "admin_free") && d.unit === "hours" ? "hours" : "days";
        const amount = Number(d.amount || 0);
        const msDelta = (unit === "hours" ? 3600000 : 86400000) * amount;
        const hrsDelta = (unit === "hours" ? 1 : 24) * amount;
        target.unlimited = false;
        target.durationUnit = unit;

        if (!target.started) {
          const curHrs = Number(target.durationHours) || ((Number(target.durationDays) || 1) * 24);
          const nextHrs = Math.max(1, curHrs + hrsDelta);
          target.durationHours = nextHrs;
          target.durationDays = Math.max(1, Math.ceil(nextHrs / 24));
          target.active = true;
        } else {
          const now = Date.now();
          const base = target.expiresAt > now ? target.expiresAt : now;
          const nextExp = base + msDelta;
          if (nextExp <= now) {
            target.expiresAt = now;
            target.active = false;
          } else {
            target.expiresAt = nextExp;
            target.active = true;
          }
        }
      }
      if (typeof saveKeys === "function") saveKeys();
      syncXray();
      jsonRes(res, 200, { ok: true, key: target });
    });
    return true;
  }

  if (pathname === "/api/dynamic-key/delete" && req.method === "POST") {
    readBody(req, d => {
      const id = Number(d.id || 0);
      if (id > 1 && Array.isArray(KEYS)) {
        const idx = KEYS.findIndex(k => k && Number(k.id) === id);
        if (idx !== -1) { KEYS.splice(idx, 1); if (typeof saveKeys === "function") saveKeys(); syncXray(); }
      }
      jsonRes(res, 200, { ok: true });
    });
    return true;
  }

  if (pathname === "/api/dynamic-key/reset-all" && req.method === "POST") {
    if (Array.isArray(KEYS)) {
      for (let i = KEYS.length - 1; i >= 0; i--) {
        if (KEYS[i] && Number(KEYS[i].id) !== 1) KEYS.splice(i, 1);
      }
      if (typeof saveKeys === "function") saveKeys();
      saveCustomGroups([]);
      syncXray();
    }
    jsonRes(res, 200, { ok: true });
    return true;
  }

  return false;
};
