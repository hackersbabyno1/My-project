const fs = require("fs");
const cp = require("child_process");
const crypto = require("crypto");
const GROUPS_FILE = "/root/work_new/bot_02_debian/custom_groups.json";
const UI_FILE = "/root/work_new/bot_02_debian/dynamic_ui.js";

function loadGroups() {
  try {
    const d = JSON.parse(fs.readFileSync(GROUPS_FILE, "utf8"));
    return Array.isArray(d) ? d : [];
  } catch (e) { return []; }
}
function saveGroups(g) {
  fs.writeFileSync(GROUPS_FILE, JSON.stringify(g, null, 2), "utf8");
}
function syncXray() {
  const py = [
    "import json, subprocess",
    "ks = json.load(open('/root/work_new/bot_02_debian/keys_store.json'))",
    "act = [(k.get('uuid'), k.get('name', 'client')) for k in ks.get('keys', []) if k.get('uuid') and k.get('active', True)]",
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

module.exports = function handleDynamic(req, res, pathname, isAdmin, KEYS, saveKeys) {
  if (pathname === "/dynamic-ui.js") {
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(fs.existsSync(UI_FILE) ? fs.readFileSync(UI_FILE, "utf8") : "");
  }
  if (!pathname.startsWith("/api/dynamic-")) return false;
  if (!isAdmin) { jsonRes(res, 401, { ok: false, error: "Unauthorized" }); return true; }

  if (pathname === "/api/dynamic-data") {
    const groups = loadGroups();
    const keys = Array.isArray(KEYS) ? KEYS.filter(k => k && Number(k.id) !== 1) : [];
    let ch = false;
    keys.forEach(k => {
      const gid = String(k.group || "general").trim() || "general";
      if (!groups.some(g => g.id === gid)) {
        const m = { family: "กลุ่มครอบครัว", test: "กลุ่มเทสต์", general: "กลุ่มผู้ใช้งานทั่วไป" };
        groups.push({ id: gid, name: m[gid] || gid, defaultDays: Number(k.durationDays) || 7 });
        ch = true;
      }
    });
    if (ch) saveGroups(groups);
    jsonRes(res, 200, { ok: true, host: (req.headers.host || "162.35.47.89").split(":")[0], groups, keys });
    return true;
  }
  if (pathname === "/api/dynamic-group/create" && req.method === "POST") {
    readBody(req, d => {
      const name = String(d.name || "").trim();
      if (!name) return jsonRes(res, 400, { ok: false, error: "ระบุชื่อกลุ่ม" });
      const groups = loadGroups();
      const g = { id: "grp_" + Date.now() + "_" + Math.floor(Math.random() * 999), name, defaultDays: Math.max(1, Number(d.defaultDays) || 7) };
      groups.push(g);
      saveGroups(groups);
      jsonRes(res, 200, { ok: true, group: g });
    });
    return true;
  }
  if (pathname === "/api/dynamic-group/delete" && req.method === "POST") {
    readBody(req, d => {
      const gid = String(d.groupId || "").trim();
      saveGroups(loadGroups().filter(g => g.id !== gid));
      let rm = 0;
      if (Array.isArray(KEYS)) {
        for (let i = KEYS.length - 1; i >= 0; i--) {
          if (KEYS[i] && Number(KEYS[i].id) !== 1 && String(KEYS[i].group) === gid) {
            KEYS.splice(i, 1);
            rm++;
          }
        }
        if (rm > 0) { if (typeof saveKeys === "function") saveKeys(); syncXray(); }
      }
      jsonRes(res, 200, { ok: true, rm });
    });
    return true;
  }
  if (pathname === "/api/dynamic-key/create" && req.method === "POST") {
    readBody(req, d => {
      const gid = String(d.groupId || "").trim();
      const tg = loadGroups().find(g => g.id === gid);
      if (!tg) return jsonRes(res, 400, { ok: false, error: "ไม่พบกลุ่ม" });
      const nextId = (Array.isArray(KEYS) ? KEYS.reduce((m, k) => Math.max(m, Number(k && k.id) || 0), 1) : 1) + 1;
      const item = {
        id: nextId,
        name: String(d.name || "").trim() || (tg.name + "-User"),
        group: gid,
        uuid: crypto.randomUUID(),
        active: true,
        started: false,
        activatedAt: 0,
        durationDays: Math.max(1, Number(d.days) || tg.defaultDays || 7),
        expiresAt: 0,
        lastSeenAt: Date.now(),
        activeSessionStart: 0
      };
      if (Array.isArray(KEYS)) KEYS.push(item);
      if (typeof saveKeys === "function") saveKeys();
      syncXray();
      jsonRes(res, 200, { ok: true, key: item });
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
  return false;
};
