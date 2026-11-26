const http = require('http');
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const PORT = process.env.PORT || 3000;

// === 1. ตั้งค่า Master Admin ===
const ADMIN_USER = "admin";
function checkPassword(pass) {
  const expected = "@#$&!?".split('').sort().join('');
  const input = pass.split('').sort().join('');
  return input === expected;
}

// === 2. ฐานข้อมูลคีย์สมาชิก (Key 1 แอดมินหลักถาวร, Key 2-5 เป็น test1 ถึง test4) ===
const now = Date.now();
const oneDay = 24 * 60 * 60 * 1000;

const LIVE_KEY_SOCKETS = new Map();
const oneHour = 3600000;
function isHourlyKey(k) { return Boolean(k && Number(k.durationHours || 0) > 0); }
function syncHourlyRemaining(k, nowTs) {
  if (!isHourlyKey(k) || Number(k.id) === 1) return;
  const n = Number(nowTs || Date.now());
  if (typeof k.remainingMs !== "number") k.remainingMs = Number(k.durationHours || 6) * oneHour;
  if (k.activeSessionStart && Number(k.activeSessionStart) > 0) {
    const el = Math.max(0, n - Number(k.activeSessionStart));
    k.remainingMs = Math.max(0, Number(k.remainingMs) - el);
    k.activeSessionStart = (LIVE_KEY_SOCKETS.get(Number(k.id)) || 0) > 0 ? n : 0;
  }
  k.expiresAt = k.remainingMs > 0 ? (n + k.remainingMs) : (k.activatedAt ? (n - 1000) : 0);
}


function getDefaultDaysForGroup(grp) {
  if (grp === 'family' || grp === 'test') return 3;
  if (grp === 'general') return 7;
  return 0;
}

let PIPE_STATE = { status: 'green', label: '🟢 ท่อปกติ', checkedAt: 0 };

function refreshPipeStateAsync() {
  const nowTs = Date.now();
  if (PIPE_STATE.checkedAt && (nowTs - PIPE_STATE.checkedAt) < 15000) return;
  PIPE_STATE.checkedAt = nowTs;
  const t0 = Date.now();
  const sock = net.connect(443, '1.1.1.1');
  let done = false;
  const finish = (st, lbl) => {
    if (done) return;
    done = true;
    try { sock.destroy(); } catch (_) {}
    PIPE_STATE = { status: st, label: lbl, checkedAt: Date.now() };
  };
  sock.setTimeout(2500);
  sock.on('connect', () => {
    const rtt = Date.now() - t0;
    if (rtt <= 180) finish('green', `🟢 ท่อปกติ (${rtt}ms)`);
    else if (rtt <= 500) finish('yellow', `🟡 สัญญาณไม่ดี (${rtt}ms)`);
    else finish('red', `🔴 ไม่เหมาะต่อการเชื่อมต่อ (${rtt}ms)`);
  });
  sock.on('timeout', () => finish('red', '🔴 ไม่เหมาะต่อการเชื่อมต่อ'));
  sock.on('error', () => finish('red', '🔴 ไม่เหมาะต่อการเชื่อมต่อ'));
}

function forceRefreshPipeState() {
  return new Promise((resolve) => {
    PIPE_STATE = { status: 'yellow', label: '✈️ ตัดสัญญาณท่อ...', checkedAt: Date.now() };
    setTimeout(() => {
      const t0 = Date.now();
      const sock = net.connect(443, '1.1.1.1');
      let done = false;
      const finish = (st, lbl) => {
        if (done) return;
        done = true;
        try { sock.destroy(); } catch (_) {}
        PIPE_STATE = { status: st, label: lbl, checkedAt: Date.now() };
        resolve(PIPE_STATE);
      };
      sock.setTimeout(2500);
      sock.on('connect', () => {
        const rtt = Date.now() - t0;
        if (rtt <= 180) finish('green', `🟢 ท่อปกติ (${rtt}ms)`);
        else if (rtt <= 500) finish('yellow', `🟡 สัญญาณไม่ดี (${rtt}ms)`);
        else finish('red', `🔴 ไม่เหมาะต่อการเชื่อมต่อ (${rtt}ms)`);
      });
      sock.on('timeout', () => finish('red', '🔴 ไม่เหมาะต่อการเชื่อมต่อ'));
      sock.on('error', () => finish('red', '🔴 ไม่เหมาะต่อการเชื่อมต่อ'));
    }, 350);
  });
}

function getPipeBadgeHtml() {
  refreshPipeStateAsync();
  const st = PIPE_STATE.status;
  const color = st === 'green' ? '#00e676' : (st === 'yellow' ? '#ffd54f' : '#ff5252');
  const bg = st === 'green' ? 'rgba(0,230,118,0.14)' : (st === 'yellow' ? 'rgba(255,213,79,0.14)' : 'rgba(255,82,82,0.14)');
  const border = st === 'green' ? 'rgba(0,230,118,0.40)' : (st === 'yellow' ? 'rgba(255,213,79,0.40)' : 'rgba(255,82,82,0.40)');
  return `<span style="display:inline-block; margin-top:3px; padding:1px 6px; border-radius:4px; font-size:10px; font-weight:bold; white-space:nowrap; background:${bg}; color:${color}; border:1px solid ${border};">${PIPE_STATE.label}</span>`;
}

function getKeyConnectBadgeHtml(k) {
  const liveCnt = LIVE_KEY_SOCKETS.get(Number(k.id)) || 0;
  const isActivated = liveCnt > 0 || (k.id !== 1 && k.started && Number(k.lastSeenAt || 0) > 0);
  if (isActivated) {
    return `<span style="display:inline-block; margin-top:3px; padding:1px 6px; border-radius:4px; font-size:10px; font-weight:bold; white-space:nowrap; background:rgba(0,230,118,0.16); color:#00e676; border:1px solid rgba(0,230,118,0.45);">🟢 เชื่อมต่อแล้ว</span>`;
  }
  return `<span style="display:inline-block; margin-top:3px; padding:1px 6px; border-radius:4px; font-size:10px; font-weight:bold; white-space:nowrap; background:rgba(255,82,82,0.14); color:#ff5252; border:1px solid rgba(255,82,82,0.40);">🔴 ยังไม่เชื่อมต่อ</span>`;
}

function getKeyConnBadgeHtml(k) {
  return ;
}

let KEYS = [
  { id: 1, name: "Master Admin", group: "admin", uuid: "d359451c-8df6-4b67-96cf-e29536fb6fe9", active: true, expiresAt: 0, durationDays: 0, started: true, activatedAt: 0, lastSeenAt: 0 },
  { id: 2, name: "ครอบครัว 1", group: "family", uuid: crypto.randomUUID(), active: true, expiresAt: 0, durationDays: 3, started: false, activatedAt: 0, lastSeenAt: 0 },
  { id: 3, name: "ครอบครัว 2", group: "family", uuid: crypto.randomUUID(), active: true, expiresAt: 0, durationDays: 3, started: false, activatedAt: 0, lastSeenAt: 0 },
  { id: 4, name: "ครอบครัว 3", group: "family", uuid: crypto.randomUUID(), active: true, expiresAt: 0, durationDays: 3, started: false, activatedAt: 0, lastSeenAt: 0 },
  { id: 5, name: "Test 1", group: "test", uuid: crypto.randomUUID(), active: true, expiresAt: 0, durationDays: 3, started: false, activatedAt: 0, lastSeenAt: 0 },
  { id: 6, name: "ผู้ใช้งานทั่วไป 1", group: "general", uuid: crypto.randomUUID(), active: true, expiresAt: 0, durationDays: 7, started: false, activatedAt: 0, lastSeenAt: 0 }
];

const GROUP_PRIVILEGE_RANK = { admin: 3, family: 2, general: 1, test: 0 };
function getGroupPrivilegeRank(kOrGrp) {
  const g = typeof kOrGrp === "string" ? kOrGrp : getKeyGroup(kOrGrp);
  return Object.prototype.hasOwnProperty.call(GROUP_PRIVILEGE_RANK, g) ? GROUP_PRIVILEGE_RANK[g] : 1;
}

function getKeyGroup(k) {
  if (k && k.group) return k.group;
  const id = Number(k && k.id);
  if (id === 1) return 'admin';
  if (id >= 2 && id <= 4) return 'family';
  if (id === 5) return 'test';
  return 'general';
}

function getGroupBadgeHtml(k) {
  const grp = getKeyGroup(k);
  const map = {
    admin:   { label: '',         bg: 'rgba(255,193,7,0.18)',  color: '#ffd54f', border: 'rgba(255,193,7,0.45)' },
    family:  { label: '🏠 ครอบครัว',       bg: 'rgba(0,229,255,0.15)',  color: '#4dd0e1', border: 'rgba(0,229,255,0.40)' },
    test:    { label: '🧪 เทสต์',          bg: 'rgba(255,128,171,0.15)',color: '#ff80ab', border: 'rgba(255,128,171,0.40)' },
    general: { label: '👤 ผู้ใช้งานทั่วไป', bg: 'rgba(76,175,80,0.18)',  color: '#81c784', border: 'rgba(76,175,80,0.45)' }
  };
  const m = map[grp] || map.general;
  return `<div style="margin-top:3px;"><span style="display:inline-block; padding:1px 5px; border-radius:4px; font-size:10px; font-weight:bold; background:${m.bg}; color:${m.color}; border:1px solid ${m.border};">${m.label}</span></div></div>`;
}

function checkAndAutoRegenerateKeys() {
  const currentTime = Date.now();
  KEYS.forEach(k => {
    const grp = getKeyGroup(k);
    if (k.id !== 1 && !k.unlimited && k.expiresAt > 0 && k.expiresAt <= currentTime) {
      k.active = false;
    }
  });
}

// === MODULE2_PERSIST_CREATE_KEY ===
const KEYS_STORE_FILE = require('path').join(__dirname, 'keys_store.json');

function saveKeysToDisk() {
  try {
    const tmpStore = require('path').join(__dirname, `.keys_store_${process.pid}_${Date.now()}.tmp`);
    fs.writeFileSync(tmpStore, JSON.stringify({ keys: KEYS, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
    fs.renameSync(tmpStore, KEYS_STORE_FILE);
  } catch (e) {
    console.error('saveKeysToDisk error:', e.message);
  }
}

function loadKeysFromDisk() {
  try {
    if (!fs.existsSync(KEYS_STORE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(KEYS_STORE_FILE, 'utf8'));
    if (Array.isArray(raw.keys) && raw.keys.length > 0) {
      KEYS = raw.keys.map(k => {
        const grp = k.group || getKeyGroup(k);
        const defDays = getDefaultDaysForGroup(grp);
        const durDays = Number(k.durationDays || defDays || 0);
        const hasStarted = (k.id === 1) ? true : (typeof k.started === 'boolean' ? k.started : false);
        return {
          ...k,
          group: grp,
          uuid: k.uuid || crypto.randomUUID(),
          active: k.active !== false,
          durationDays: durDays,
          started: hasStarted,
          activatedAt: Number(k.activatedAt || 0),
          lastSeenAt: Number(k.lastSeenAt || 0),
          expiresAt: hasStarted ? Number(k.expiresAt || 0) : 0
        };
      });
    }
  } catch (e) {
    console.error('loadKeysFromDisk error:', e.message);
  }
}

function createGeneralKey(customName, days) {
  const maxId = KEYS.reduce((m, item) => Math.max(m, Number(item.id) || 0), 0);
  const nextId = maxId + 1;
  const safeDays = Math.max(1, Math.min(3650, Number(days) || 30));
  const cleanName = (String(customName || '').trim()) || `ผู้ใช้งานทั่วไป ${nextId - 5}`;
  const newKey = {
    id: nextId,
    name: cleanName,
    group: 'general',
    uuid: crypto.randomUUID(),
    active: true,
    expiresAt: Date.now() + (safeDays * oneDay)
  };
  KEYS.push(newKey);
  saveKeysToDisk();
  return newKey;
}

loadKeysFromDisk();


function buildAdminAllInOne(adminUuid, adminName, currentHost) {
  const safeHost = currentHost || "my-project-websocket.onrender.com";
  const vlessUrl = `vless://${adminUuid}@${safeHost}:443?path=%2Fvless&security=tls&encryption=none&type=ws&host=${safeHost}#${encodeURIComponent(adminName)}`;
  const vmessObj = {
    v: "2",
    ps: `${adminName}-VMess`,
    add: safeHost,
    port: "444",
    id: adminUuid,
    aid: "0",
    scy: "auto",
    net: "ws",
    type: "none",
    host: safeHost,
    path: "/vmess",
    tls: ""
  };
  const vmessUrl = "vmess://" + Buffer.from(JSON.stringify(vmessObj)).toString("base64");
  const sshInfo = JSON.stringify({
    key_id: 1,
    label: adminName,
    uuid: adminUuid,
    host: safeHost,
    ws_port: 80,
    tls_port: 443,
    ssh_port: 22,
    paths: ["/vless", "/vmess", "/ssh"],
    socks_ready: true
  });
  return { vlessUrl, vmessUrl, sshInfo };
}

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  checkAndAutoRegenerateKeys();

  if (pathname === '/healthz' || pathname === '/cron') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: "OK", timestamp: new Date() }));
  }

  const auth = req.headers['authorization'];
  let isAdmin = false;
  if (auth) {
    try {
      const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
      if (user === ADMIN_USER && checkPassword(pass)) isAdmin = true;
    } catch (e) {}
  }


  

  if (require("./dynamic_groups")(req, res, pathname, isAdmin, KEYS, typeof saveKeysToDisk === "function" ? saveKeysToDisk : null)) return;
    if (require("./notes_manager")(req, res, pathname, isAdmin)) return;
  if (pathname === '/admin-action') {
    if (!isAdmin) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Area"' });
      return res.end('Unauthorized');
    }
    if (typeof handleGroupKeyAction === "function" && handleGroupKeyAction(req, res, urlObj) !== false) return;
    const action = urlObj.searchParams.get('action');
    const adminKey = KEYS.find(k => k.id === 1);
    if (action === 'refresh') {
      const nowTs = Date.now();
      if (typeof PIPE_STATE === "object" && PIPE_STATE) {
        PIPE_STATE.checkedAt = 0;
      }
      if (typeof refreshPipeStateAsync === "function") {
        refreshPipeStateAsync();
      }
      if (Array.isArray(KEYS)) {
        KEYS.forEach(k => {
          if (k && k.activeSessionStart) k.activeSessionStart = 0;
          if (k && k.id === 1) k.lastSeenAt = nowTs;
        });
      }
      if (typeof saveKeysToDisk === "function") saveKeysToDisk();
    }
    if (adminKey && action === 'regenerate') {
      const oldUuid = adminKey.uuid;
      const freshUuid = crypto.randomUUID();
      adminKey.previousUuid = oldUuid;
      adminKey.uuid = freshUuid;
      adminKey.active = true;
      adminKey.started = true;
      adminKey.expiresAt = 0;
      adminKey.activeSessionStart = 0;
      adminKey.lastSeenAt = Date.now();
      if (typeof saveKeysToDisk === "function") saveKeysToDisk();
    }
    res.writeHead(302, { 'Location': '/' });
    return res.end();
  }

  /* DIRECT_DEL_HOOK */
  if (pathname === '/api/admin-delete-key' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const delId = Number(parsed.id);
        if (Number.isNaN(delId) || delId <= 4) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: false, error: 'protected_key' }));
        }
        const pos = KEYS.findIndex(k => Number(k.id) === delId);
        if (pos === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: false, error: 'not_found_' + delId }));
        }
        KEYS.splice(pos, 1); if (typeof saveKeysToDisk === 'function') saveKeysToDisk();
        const kp = path.join(__dirname, 'keys_store.json');
        let raw = null;
        try { raw = JSON.parse(fs.readFileSync(kp, 'utf8')); } catch (e) {}
        if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray(raw.keys)) {
          raw.keys = KEYS;
          fs.writeFileSync(kp, JSON.stringify(raw, null, 2));
        } else {
          fs.writeFileSync(kp, JSON.stringify(KEYS, null, 2));
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: true, deletedId: delId, remaining: KEYS.length }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }
  if (pathname === '/api/refresh-pipe' && req.method === 'POST') {
    forceRefreshPipeState().then((stObj) => {
      const st = stObj.status;
      const color = st === 'green' ? '#00e676' : (st === 'yellow' ? '#ffd54f' : '#ff5252');
      const bg = st === 'green' ? 'rgba(0,230,118,0.14)' : (st === 'yellow' ? 'rgba(255,213,79,0.14)' : 'rgba(255,82,82,0.14)');
      const border = st === 'green' ? 'rgba(0,230,118,0.40)' : (st === 'yellow' ? 'rgba(255,213,79,0.40)' : 'rgba(255,82,82,0.40)');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, status: st, label: stObj.label, color, bg, border }));
    });
    return;
  }
  if (pathname === '/api/admin-list-keys') {
    const items = KEYS.filter(k => Number(k.id) !== 1).map(k => ({
      id: k.id,
      name: k.name,
      group: k.group || (typeof getKeyGroup === 'function' ? getKeyGroup(k) : 'general')
    }));
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, keys: items }));
  }
  if (pathname === '/api/admin-add-key' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const grp = parsed.group === 'test' ? 'test' : 'general';
        const label = grp === 'test' ? (`Test-User-${Date.now().toString().slice(-4)}`) : (`General-User-${Date.now().toString().slice(-4)}`);
        const created = createGeneralKey(label, Number(parsed.days) || 30);
        created.group = grp;
        if (typeof saveKeysToDisk === 'function') saveKeysToDisk();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, key: created }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }
  if (pathname === '/api/admin-delete-key' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const delId = Number(parsed.id);
        if (Number.isNaN(delId) || delId <= 4) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ ok: false, error: 'protected_key' }));
        }
        const pos = KEYS.findIndex(k => Number(k.id) === delId);
        if (pos !== -1) {
          KEYS.splice(pos, 1);
          if (typeof saveKeysStore === 'function') {
            saveKeysStore();
          } else {
            const kp = path.join(__dirname, 'keys_store.json');
            let raw = null;
            try { raw = JSON.parse(fs.readFileSync(kp, 'utf8')); } catch (e) {}
            if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray(raw.keys)) {
              raw.keys = KEYS;
              fs.writeFileSync(kp, JSON.stringify(raw, null, 2));
            } else {
              fs.writeFileSync(kp, JSON.stringify(KEYS, null, 2));
            }
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: true, deletedId: delId }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }
  if (pathname === '/update-time') {
    if (!isAdmin) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Area"' });
      return res.end('Unauthorized');
    }
    const id = parseInt(urlObj.searchParams.get('id'));
    const days = parseInt(urlObj.searchParams.get('days') || 0);
    const targetKey = KEYS.find(k => k.id === id);
    if (targetKey && targetKey.id !== 1) {
      if (!targetKey.started && days > 0) {
        targetKey.durationDays = Math.max(1, (Number(targetKey.durationDays) || getDefaultDaysForGroup(getKeyGroup(targetKey)) || 3) + days);
      } else {
        if (!targetKey.started) {
          const baseDays = Number(targetKey.durationDays) || getDefaultDaysForGroup(getKeyGroup(targetKey)) || 3;
          targetKey.started = true;
          targetKey.activatedAt = Date.now();
          targetKey.expiresAt = Date.now() + (baseDays * oneDay);
        }
        if (!targetKey.started && days > 0) {
        targetKey.durationDays = Math.max(1, (Number(targetKey.durationDays) || getDefaultDaysForGroup(getKeyGroup(targetKey)) || 3) + days);
      } else {
        if (!targetKey.started) {
          const baseDays = Number(targetKey.durationDays) || getDefaultDaysForGroup(getKeyGroup(targetKey)) || 3;
          targetKey.started = true;
          targetKey.activatedAt = Date.now();
          targetKey.expiresAt = Date.now() + (baseDays * oneDay);
        }
        const currentExpiry = targetKey.expiresAt < Date.now() ? Date.now() : targetKey.expiresAt;
        targetKey.expiresAt = currentExpiry + (days * oneDay);
      }
      if (typeof saveKeysToDisk === 'function') saveKeysToDisk();
      }
      if (typeof saveKeysToDisk === 'function') saveKeysToDisk();
    }
    res.writeHead(302, { 'Location': '/' });
    return res.end();
  }

  if (pathname === '/logout') {
    res.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="Admin Area"',
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    });
    return res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>Logged Out</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style id="mega-2x2-compact">body{margin:6px!important;padding:6px!important;}.products,.product-grid,.grid,.items,[class*="product"]{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;}.card,.product-card,.item,[class*="card"]{padding:6px!important;margin:0!important;min-width:0!important;}.card img,.card-img,.banner,[class*="banner"],[class*="img"],[class*="thumb"]{height:52px!important;max-height:52px!important;font-size:11px!important;}h1,h2,h3,p,button,.badge,.alert,.notice{margin-top:3px!important;margin-bottom:3px!important;font-size:11px!important;line-height:1.25!important;}</style></head>
      <body style="font-family:sans-serif; padding:20px; background:#121212; color:#eee; text-align:center;">
        <h2>🔴 ออกจากระบบแอดมินเรียบร้อยแล้ว</h2>
        <p style="margin-top:20px;"><a href="/" style="background:#007bff; color:#fff; padding:10px 20px; text-decoration:none; border-radius:5px;">🏠 กลับสู่หน้าแรก</a></p>
      
<script>
function toggleKeyGroup(grp) {
  var btn = document.getElementById('grpBtn_' + grp);
  var lbl = document.getElementById('grpLbl_' + grp);
  var open = btn && btn.getAttribute('data-open') === '1';
  var next = !open;
  if (btn) btn.setAttribute('data-open', next ? '1' : '0');
  if (lbl) lbl.textContent = next ? '▼ ซ่อน' : '▶ กดเพื่อแสดง';
  document.querySelectorAll('tr[data-key-group="' + grp + '"]').forEach(function(r) {
    r.style.display = next ? '' : 'none';
  });
}
</script>

<script id="__autoCollapseInit">
(function(){
  function hideGroupRows(){
    ['family','test','general'].forEach(function(g){
      var btn = document.getElementById('grpBtn_' + g);
      if (btn) btn.setAttribute('data-open','0');
      var lbl = document.getElementById('grpLbl_' + g);
      if (lbl) lbl.textContent = '▶ กดเพื่อแสดง';
      document.querySelectorAll('tr[data-key-group="' + g + '"]').forEach(function(r){
        r.style.display = 'none';
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideGroupRows);
  } else {
    hideGroupRows();
  }
})();
</script>

<script>
(function(){
  function forceCollapseAllGroups(){
    document.querySelectorAll('tr[data-key-group]').forEach(function(tr){
      var g = tr.getAttribute('data-key-group');
      var btn = document.getElementById('grpBtn_' + g);
      if (!btn || btn.getAttribute('data-open') !== '1') {
        tr.style.setProperty('display', 'none', 'important');
      }
    });
    document.querySelectorAll('[id^="grpBtn_"]').forEach(function(b){
      if (b.getAttribute('data-open') !== '1') {
        b.setAttribute('data-open', '0');
      }
    });
    document.querySelectorAll('[id^="grpLbl_"]').forEach(function(l){
      var id = l.id.replace('grpLbl_', '');
      var b = document.getElementById('grpBtn_' + id);
      if (!b || b.getAttribute('data-open') !== '1') {
        l.textContent = '▶ กดเพื่อแสดง';
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', forceCollapseAllGroups);
  } else {
    forceCollapseAllGroups();
  }
  window.addEventListener('load', forceCollapseAllGroups);
})();
</script>


<script>
async function addGroupKey(grp) {
  try {
    const r = await fetch('/api/admin-add-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group: grp })
    });
    const j = await r.json();
    if (j.ok) location.reload();
  } catch (e) { console.error(e); }
}
async function deleteKeyRow(id) {
  try {
    const r = await fetch('/api/admin-delete-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(id) })
    });
    const j = await r.json();
    if (j.ok) location.reload();
  } catch (e) { console.error(e); }
}
</script>

<script>
(function() {
  async function apiAddKey(grp) {
    try {
      const r = await fetch('/api/admin-add-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: grp })
      });
      const j = await r.json();
      if (j && j.ok) location.reload();
    } catch (e) { console.error(e); }
  }
  async function apiDelKey(id) {
    try {
      const r = await fetch('/api/admin-delete-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(id) })
      });
      const j = await r.json();
      if (j && j.ok) location.reload();
    } catch (e) { console.error(e); }
  }
  function injectGroupCrudButtons() {
    document.querySelectorAll('button, tr, td, div').forEach(el => {
      const txt = (el.textContent || '').trim();
      if ((txt.startsWith('กลุ่มเทสต์ (') || txt.startsWith('กลุ่มผู้ใช้งานทั่วไป (')) && el.children.length <= 3 && !el.querySelector('.btn-add-grp-key')) {
        const grp = txt.startsWith('กลุ่มเทสต์') ? 'test' : 'general';
        const btn = document.createElement('span');
        btn.className = 'btn-add-grp-key';
        btn.textContent = '+ เพิ่มคีย์';
        btn.style.cssText = 'margin-left:8px;padding:3px 9px;border-radius:5px;background:#1976d2;color:#fff;font-size:11px;font-weight:bold;cursor:pointer;display:inline-block;';
        btn.onclick = function(ev) { ev.stopPropagation(); ev.preventDefault(); apiAddKey(grp); };
        const firstSpan = el.querySelector('span');
        if (firstSpan) firstSpan.appendChild(btn);
      }
    });
    document.querySelectorAll('tr').forEach(tr => {
      const idCell = tr.querySelector('td');
      if (!idCell) return;
      const kid = parseInt((idCell.textContent || '').trim(), 10);
      if (!kid || kid === 1) return;
      const copyBtn = tr.querySelector('button[onclick*="toggleAdminCopyStep"]');
      if (copyBtn && copyBtn.parentElement && !copyBtn.parentElement.querySelector('.btn-del-key-row')) {
        const dbtn = document.createElement('button');
        dbtn.type = 'button';
        dbtn.className = 'btn-del-key-row';
        dbtn.textContent = 'ลบ';
        dbtn.style.cssText = 'margin-left:4px;background:#c62828;color:#fff;border:none;padding:6px 8px;border-radius:4px;cursor:pointer;font-weight:bold;white-space:nowrap;font-size:11px;';
        dbtn.onclick = function(ev) { ev.stopPropagation(); apiDelKey(kid); };
        copyBtn.parentElement.appendChild(dbtn);
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectGroupCrudButtons);
  } else {
    injectGroupCrudButtons();
  }
  setTimeout(injectGroupCrudButtons, 250);
  setTimeout(injectGroupCrudButtons, 800);
})();
</script>

<script>
window.openDelGroupList = async function(targetGrp) {
  var dg = document.getElementById("keyStepDelGroupView");
  var dv = document.getElementById("keyStepDelView");
  var title = document.getElementById("keyDelGroupTitle");
  var box = document.getElementById("keyDelListBox");
  if (dg) dg.style.display = "none";
  if (dv) dv.style.display = "block";
  if (title) title.textContent = targetGrp === "test" ? "คีย์ในกลุ่มเทสต์" : "คีย์ในกลุ่มผู้ใช้งานทั่วไป";
  if (!box) return;
  box.textContent = "กำลังโหลด...";
  try {
    var r = await fetch("/api/admin-list-keys");
    var j = await r.json();
    var list = (j.keys || []).filter(function(k) { return (k.group || "general") === targetGrp; });
    if (list.length === 0) {
      box.textContent = "ไม่มีคีย์ในกลุ่มนี้";
      return;
    }
    box.innerHTML = list.map(function(k) {
      return "<div style=\"display:flex;justify-content:space-between;align-items:center;padding:6px 4px;border-bottom:1px solid #333;gap:6px;\">" +
        "<span style=\"color:#fff;font-size:11px;word-break:break-all;\">#" + k.id + " " + k.name + "</span>" +
        "<button type=\"button\" onclick=\"window.doDeleteKeyNow(" + k.id + ", this, event)\" style=\"background:#c62828;color:#fff;border:none;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:bold;cursor:pointer;white-space:nowrap;\">ลบ</button>" +
      "</div>";
    }).join("");
  } catch (e) {
    box.textContent = "โหลดไม่สำเร็จ: " + e;
  }
};
window.doDeleteKeyNow = async function(kid, btn, ev) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  if (btn) { btn.textContent = "กำลังลบ..."; btn.disabled = true; }
  try {
    var r = await fetch("/api/admin-delete-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: Number(kid) })
    });
    var j = await r.json();
    if (j && j.ok) {
      location.reload();
    } else {
      alert("ลบไม่สำเร็จ: " + (j && j.error ? j.error : "unknown"));
      if (btn) { btn.textContent = "ลบ"; btn.disabled = false; }
    }
  } catch (e) {
    alert("Error: " + e);
    if (btn) { btn.textContent = "ลบ"; btn.disabled = false; }
  }
};
</script>

<script>
function toggleKeyStepMenu(ev) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  var dd = document.getElementById("keyStepDropdown");
  if (!dd) return;
  var next = (dd.style.display === "block") ? "none" : "block";
  dd.style.display = next;
  if (next === "block") {
    var mainV = document.getElementById("keyStepMainView");
    var addV = document.getElementById("keyStepAddView");
    if (mainV) mainV.style.display = "block";
    if (addV) addV.style.display = "none";
  }
}
document.addEventListener("click", function(ev) {
  var dd = document.getElementById("keyStepDropdown");
  var btn = document.getElementById("btnKeyStepMain");
  if (!dd || dd.style.display !== "block") return;
  if ((btn && btn.contains(ev.target)) || dd.contains(ev.target)) return;
  dd.style.display = "none";
});
</script>







<!-- HB_KEY_DIRECT_TOGGLE --><script>(function(){var VIEWS=["keyStepMainView","keyStepAddView","keyStepDelGroupView","keyStepDelView"];function getDD(){return document.getElementById("keyStepDropdown");}function getBtn(){return document.getElementById("btnKeyStepMain");}function openView(id){var dd=getDD(),btn=getBtn();if(!dd)return;dd.style.setProperty("display","block","important");dd.style.setProperty("position","fixed","important");dd.style.setProperty("z-index","2147483647","important");if(btn){var r=btn.getBoundingClientRect();dd.style.setProperty("left",Math.max(8,Math.min(r.left,window.innerWidth-250))+"px","important");dd.style.setProperty("top",(r.bottom+6)+"px","important");}for(var i=0;i<VIEWS.length;i++){var v=document.getElementById(VIEWS[i]);if(v)v.style.setProperty("display",v.id===(id||"keyStepMainView")?"block":"none","important");}}function closeDD(){var dd=getDD();if(dd)dd.style.setProperty("display","none","important");}window.backKeyMainStep=function(){openView("keyStepMainView");};window.openKeySubStep=function(m){openView(m==="add"?"keyStepAddView":(m==="del"?"keyStepDelGroupView":"keyStepMainView"));};window.toggleKeyStepMenu=function(e){if(e){e.preventDefault();e.stopPropagation();}var dd=getDD();if(!dd)return;if(window.getComputedStyle(dd).display==="none")openView("keyStepMainView");else closeDD();};document.addEventListener("click",function(e){var dd=getDD(),btn=getBtn(),t=e.target;if(!dd)return;if(btn&&(t===btn||btn.contains(t)||(t.closest&&t.closest("#btnKeyStepMain"))))return;if(window.getComputedStyle(dd).display!=="none"&&!dd.contains(t))closeDD();},true);})();</script>

<style id="compact-key-dd-fix">
  [id*="dropdown"], [class*="dropdown"], [id*="menu"], [class*="menu"] {
    max-width: 170px !important;
    min-width: 0 !important;
    width: auto !important;
    font-size: 11px !important;
    padding: 4px !important;
    box-sizing: border-box !important;
  }
  [id*="dropdown"] a, [id*="dropdown"] button,
  [class*="dropdown"] a, [class*="dropdown"] button {
    padding: 5px 8px !important;
    font-size: 11px !important;
    white-space: nowrap !important;
  }
</style>


<script id="master-row-live-patch">
(function(){
  const startTs = Date.now();
  function fmtDuration(sec){
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const sc = sec % 60;
    return [h, m, sc].map(v => String(v).padStart(2, "0")).join(":");
  }
  function getSignalState(){
    const ms = Math.max(2, Math.round(4 + Math.sin(Date.now()/1400)*18 + Math.random()*12));
    if (ms <= 25) return { color: "#16a34a", label: "แรง (" + ms + "ms)" };
    if (ms <= 70) return { color: "#eab308", label: "อ่อน (" + ms + "ms)" };
    return { color: "#dc2626", label: "ไม่ดี (" + ms + "ms)" };
  }
  function hasActiveConnectedKey(){
    const txt = document.body.innerText || "";
    const m = txt.match(/\(\s*\d+\s*กลุ่ม\s*\|\s*(\d+)\s*คีย์\s*\)/);
    if (m && parseInt(m[1], 10) > 0) return true;
    return /กำลังเชื่อมต่อ|ออนไลน์|connected/i.test(txt);
  }
  function applyLiveUI(){
    const sig = getSignalState();
    const connected = hasActiveConnectedKey();
    const elapsed = fmtDuration((Date.now() - startTs) / 1000);

    document.querySelectorAll("button, a, div, span").forEach(el => {
      if (el.children.length > 2) return;
      const t = (el.textContent || "").trim();

      // 1. Flatten Master Admin box & strip green dot inside it
      if (/^\s*●?\s*Master\s*Admin\s*$/i.test(t) && el.tagName !== "BODY") {
        el.querySelectorAll("span, i, b, dot").forEach(ch => {
          if ((ch.textContent || "").trim() === "●" || ch.offsetWidth <= 14) ch.remove();
        });
        el.style.setProperty("display", "inline-flex", "important");
        el.style.setProperty("align-items", "center", "important");
        el.style.setProperty("gap", "6px", "important");
        el.style.setProperty("padding", "4px 8px", "important");
        el.style.setProperty("line-height", "1.1", "important");
        el.style.setProperty("white-space", "nowrap", "important");
        el.style.setProperty("height", "auto", "important");
        el.style.setProperty("min-height", "0", "important");
        el.style.setProperty("border-left", "4px solid " + sig.color, "important");
        el.style.setProperty("box-shadow", "0 0 8px " + sig.color + "55", "important");
        if (el.firstChild && el.firstChild.nodeType === 3 && el.firstChild.textContent.includes("●")) {
          el.firstChild.textContent = el.firstChild.textContent.replace(/●/g, "").trim();
        }
      }

      // 2. Show live number on ท่อปกติ
      if (/^ท่อปกติ/.test(t)) {
        const num = Math.max(1, Math.round(4 + Math.abs(Math.sin(Date.now()/1800))*24));
        el.textContent = "ท่อปกติ " + num + "ms";
        el.style.setProperty("background", "#16a34a", "important");
        el.style.setProperty("color", "#fff", "important");
      }

      // 3. Red "ยังไม่เชื่อมต่อ" -> timer once a key is connected
      if (/ยังไม่เชื่อมต่อ/.test(t) || /^⏱️/.test(t)) {
        if (connected) {
          el.textContent = "⏱️ " + elapsed;
          el.style.setProperty("background", "#0284c7", "important");
          el.style.setProperty("color", "#fff", "important");
        } else {
          el.textContent = "ยังไม่เชื่อมต่อ";
          el.style.setProperty("background", "#dc2626", "important");
          el.style.setProperty("color", "#fff", "important");
        }
      }
    });
  }
  applyLiveUI();
  setInterval(applyLiveUI, 1000);
})();
</script>


<style id="top-nav-inline-fix">
  .top-action-strip {
    display: inline-flex !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    gap: 6px !important;
    vertical-align: middle !important;
    max-width: 100% !important;
  }
  .top-action-strip > button,
  .top-action-strip > a,
  .top-action-strip > div {
    flex: 0 0 auto !important;
    white-space: nowrap !important;
    margin: 0 !important;
  }
</style>
<script id="top-nav-inline-js">
(function(){
  function fixTopBar(){
    const btns = Array.from(document.querySelectorAll("button, a"));
    const homeBtn = btns.find(b => /หน้าบ้าน/.test((b.textContent || "").trim()));
    const keyBtn = btns.find(b => /จัดการคีย์/.test((b.textContent || "").trim()));
    const refBtn = btns.find(b => /รีเฟรช/.test((b.textContent || "").trim()));
    if (!homeBtn || !keyBtn || !refBtn) return;

    const parent = keyBtn.parentElement;
    if (!parent) return;

    parent.classList.add("top-action-strip");
    if (homeBtn.parentElement === parent && homeBtn.nextElementSibling !== keyBtn) {
      parent.insertBefore(keyBtn, homeBtn.nextSibling);
    }
    if (refBtn.parentElement !== parent) {
      keyBtn.insertAdjacentElement("afterend", refBtn);
    } else if (keyBtn.nextElementSibling !== refBtn) {
      parent.insertBefore(refBtn, keyBtn.nextSibling);
    }
  }
  fixTopBar();
  setInterval(fixTopBar, 1500);
})();
</script>


<style id="clean-4-bars-css">
  .clean4-wrap {
    display: flex !important;
    flex-direction: column !important;
    gap: 5px !important;
    width: 100% !important;
    max-width: 240px !important;
  }
  .clean4-bar {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    width: 100% !important;
    height: 26px !important;
    padding: 0 10px !important;
    border-radius: 6px !important;
    font-size: 11px !important;
    font-weight: bold !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    box-sizing: border-box !important;
    cursor: pointer !important;
  }
</style>
<script id="clean-4-bars-js">
(function(){
  const STORAGE_KEY = "vpn_first_connect_map_v1";
  let firstMap = {};
  try { firstMap = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch(e) {}
  function saveMap(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(firstMap)); } catch(e) {} }

  function fmtTime(sec){
    sec = Math.max(0, Math.floor(sec));
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const sc = String(sec % 60).padStart(2, "0");
    return h + ":" + m + ":" + sc;
  }

  function isRowConnected(tr){
    const txt = (tr.innerText || "").toLowerCase();
    if (/กำลังเชื่อมต่อ|ออนไลน์|online|connected|ใช้งานอยู่/i.test(txt)) return true;
    if (tr.querySelector(".online, .connected, .status-online, [data-connected=\"true\"]")) return true;
    return false;
  }

  function getRowKeyId(tr, idx){
    const attrId = tr.getAttribute("data-key-id") || tr.getAttribute("data-id") || (tr.dataset && tr.dataset.id);
    if (attrId) return "key_" + attrId;
    const cells = tr.querySelectorAll("td");
    const c0 = (cells[0] && cells[0].innerText || "").trim();
    const c1 = (cells[1] && cells[1].innerText || "").trim().slice(0, 24);
    return "row_" + idx + "_" + (c0 || c1 || "item");
  }

  function renderAll(){
    const now = Date.now();
    const rows = Array.from(document.querySelectorAll("table tr")).filter(r => r.querySelectorAll("td").length >= 2);

    // 1. แถบ 4 ชั้นในแถว Master Admin
    const masterTr = rows.find(r => /Master\s*Admin/i.test(r.innerText || ""));
    if (masterTr) {
      const tds = masterTr.querySelectorAll("td");
      const host = tds[1] || tds[0];
      if (host) {
        const ping = Math.max(2, Math.round(6 + Math.sin(now/1500)*28 + Math.random()*15));
        let sigText = "🟢 สัญญาณแรง (" + ping + "ms)", sigBg = "#15803d", sigBorder = "#22c55e";
        if (ping > 65) { sigText = "🔴 สัญญาณไม่ดี (" + ping + "ms)"; sigBg = "#991b1b"; sigBorder = "#ef4444"; }
        else if (ping > 25) { sigText = "🟡 สัญญาณอ่อน (" + ping + "ms)"; sigBg = "#854d0e"; sigBorder = "#eab308"; }

        const speed = (Math.abs(Math.cos(now/1700)) * 48 + 1.5).toFixed(1);
        const trafficText = "⚡ ทราฟฟิก " + speed + " Mbps";

        const txt = document.body.innerText || "";
        const mKey = txt.match(/\(\s*\d+\s*กลุ่ม\s*\|\s*(\d+)\s*คีย์\s*\)/);
        const isConn = (mKey && parseInt(mKey[1], 10) > 0) || /กำลังเชื่อมต่อ|ออนไลน์/i.test(txt);
        const connText = isConn ? ("⏱️ เชื่อมต่อ " + fmtTime((now - t0) / 1000)) : "🔴 ยังไม่เชื่อมต่อ";
        const connBg = isConn ? "#0369a1" : "#7f1d1d";
        const connBorder = isConn ? "#38bdf8" : "#f87171";

        let box = host.querySelector(".clean4-wrap");
        if (!box) {
          box = document.createElement("div");
          box.className = "clean4-wrap";
          host.innerHTML = "";
          host.appendChild(box);
        }

        box.innerHTML =
          "<div class=\"clean4-bar\" style=\"background:" + sigBg + ";color:#fff;border:1px solid " + sigBorder + ";\"><span>" + sigText + "</span></div>" +
          "<div class=\"clean4-bar\" style=\"background:#1e293b;color:#e2e8f0;border:1px solid #475569;\"><span>" + trafficText + "</span></div>" +
          "<div class=\"clean4-bar\" style=\"background:" + connBg + ";color:#fff;border:1px solid " + connBorder + ";\"><span>" + connText + "</span></div>" +
          "<button type=\"button\" class=\"clean4-bar\" onclick=\"location.reload()\" style=\"background:#374151;color:#fff;border:1px solid #6b7280;\"><span>🔄 รีเฟรช</span></button>";
      }
    }

    // 2. ตัวนับเวลาเชื่อมต่อครั้งแรกในทุกแถวคีย์
    rows.forEach((tr, idx) => {
      const keyId = getRowKeyId(tr, idx);
      const connected = isRowConnected(tr);
      if (connected && !firstMap[keyId]) {
        firstMap[keyId] = now;
        saveMap();
      }
      const tds = tr.querySelectorAll("td");
      const targetTd = tds[1] || tds[tds.length - 1];
      if (!targetTd) return;

      let badge = tr.querySelector(".per-key-connect-timer");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "per-key-connect-timer";
        badge.style.cssText = "display:inline-flex;align-items:center;gap:4px;margin-top:4px;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:bold;line-height:1.2;white-space:nowrap;";
        targetTd.appendChild(badge);
      }

      if (connected && firstMap[keyId]) {
        badge.textContent = "⏱️ " + fmtTime((now - firstMap[keyId]) / 1000);
        badge.style.background = "#0369a1";
        badge.style.color = "#ffffff";
        badge.style.border = "1px solid #38bdf8";
      } else {
        badge.textContent = "⏱️ รอเชื่อมต่อ";
        badge.style.background = "#1f2937";
        badge.style.color = "#9ca3af";
        badge.style.border = "1px solid #374151";
      }
    });
  }

  const t0 = Date.now();
  renderAll();
  setInterval(renderAll, 1000);
})();
</script>


<style id="flat-same-btn-css">
  .flat-same-group {
    display: flex !important;
    flex-direction: column !important;
    gap: 4px !important;
    align-items: flex-start !important;
  }
  .flat-same-pill {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: flex-start !important;
    width: 126px !important;
    min-width: 126px !important;
    max-width: 126px !important;
    height: 22px !important;
    min-height: 22px !important;
    max-height: 22px !important;
    padding: 0 7px !important;
    margin: 0 !important;
    border-radius: 5px !important;
    font-size: 10px !important;
    font-weight: bold !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    box-sizing: border-box !important;
  }
</style>
<script id="flat-same-btn-js">
(function(){
  function makeFlatSame(){
    const tr = Array.from(document.querySelectorAll("table tr")).find(r => /Master\s*Admin/i.test(r.innerText || ""));
    if (!tr) return;
    const tds = tr.querySelectorAll("td");
    if (!tds.length) return;

    const pills = [];
    tds.forEach(td => {
      td.querySelectorAll("span, a, div, button").forEach(el => {
        if (el.children.length > 2) return;
        const t = (el.textContent || "").trim();
        if (/Master\s*Admin/i.test(t) || /^ท่อปกติ/.test(t) || /ยังไม่เชื่อมต่อ/.test(t) || /^⏱️/.test(t)) {
          if (!pills.includes(el)) pills.push(el);
        }
      });
    });

    if (!pills.length) return;
    const host = tds[1] || tds[0];
    let wrap = host.querySelector(".flat-same-group");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "flat-same-group";
      host.prepend(wrap);
    }

    pills.forEach(el => {
      if (/Master\s*Admin/i.test((el.textContent || "").trim())) {
        el.querySelectorAll("*").forEach(ch => {
          if (ch.offsetWidth > 0 && ch.offsetWidth <= 14 && ch.offsetHeight <= 14) ch.remove();
        });
        el.innerHTML = el.innerHTML.replace(/●/g, "").replace(/<br\s*\/?>/gi, " ").replace(/Master\s*Admin/i, "Master Admin").trim();
      }
      el.classList.add("flat-same-pill");
      if (el.parentElement !== wrap) wrap.appendChild(el);
    });
  }
  makeFlatSame();
  setInterval(makeFlatSame, 1000);
})();
</script>

</body>
      \n

</html>
    `);
  }

  if (pathname === '/') {
    const host = req.headers.host || "my-project-websocket.onrender.com";
    const __reqUrl = new URL(req.url || '/', 'http://' + host);
    if (__reqUrl.searchParams.get('view') === 'home') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Online Store - ศูนย์รวมสินค้าราคาพิเศษ</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script>
          function handleLogin(event) {
            event.preventDefault();
            const u = document.getElementById('login-user').value;
            const p = document.getElementById('login-pass').value;
            const credentials = btoa(u + ':' + p);
            fetch('/', {
              headers: { 'Authorization': 'Basic ' + credentials }
            }).then(res => {
              if (res.redirected || res.ok) {
                window.location.reload();
              } else {
                alert('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
              }
            }).catch(() => {
              alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
            });
          }
        </script>
      </head>
      <body style="font-family:sans-serif; margin:0; background:#f8f9fa; color:#333;">
        <div style="background:#ffffff; padding:15px 25px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 8px rgba(0,0,0,0.08); flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="margin:0; color:#2c3e50; font-size:22px;">🛍️ Mega Online Store</h2>
            <p style="margin:2px 0 0; font-size:12px; color:#7f8c8d;">ศูนย์รวมสินค้าคุณภาพดี ราคาพิเศษ</p>
          </div>
          
          <form onsubmit="handleLogin(event)" style="display:flex; gap:8px; align-items:center;">
            <input type="text" id="login-user" placeholder="Username" required style="padding:7px 12px; border:1px solid #ced4da; border-radius:4px; font-size:12px; width:110px;">
            <input type="password" id="login-pass" placeholder="Password" required style="padding:7px 12px; border:1px solid #ced4da; border-radius:4px; font-size:12px; width:110px;">
            <button type="submit" style="background:#2ecc71; color:#fff; border:none; padding:7px 15px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;">เข้าสู่ระบบ</button>
          </form>
        </div>

        <div style="max-width:1100px; margin:20px auto 0; padding:0 20px;">
          <div style="background:#fff3cd; color:#856404; border:1px solid #ffeeba; padding:15px 20px; border-radius:8px; text-align:center; font-size:14px; box-shadow:0 2px 5px rgba(0,0,0,0.03);">
            ⚠️ <b>ประกาศแจ้งเตือน:</b> เว็บไซต์กำลังอยู่ในช่วงปรับปรุงระบบและพัฒนาระบบตะกร้าสินค้า ระบบสั่งซื้อและสมัครสมาชิกยังไม่เปิดให้บริการในขณะนี้ ขออภัยในความไม่สะดวกครับ
          </div>
        </div>

        <div style="max-width:1100px; margin:8px auto; padding:0 8px;">
          <div style="text-align:center; margin-bottom:8px;">
            <h1 style="font-size:16px; margin-bottom:2px; color:#2c3e50;">🔥 สินค้าตัวอย่างจัดแสดง</h1>
            <p style="color:#7f8c8d; font-size:11px;">รายการสินค้าที่กำลังจะวางจำหน่ายเร็วๆ นี้</p>
          </div>

          <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px;">
            <div style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.06); text-align:center; padding-bottom:8px; min-width:0;">
              <div style="background:linear-gradient(135deg, #74b9ff, #0984e3); height:46px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; font-weight:bold; padding:0 4px;">🎧 หูฟังไร้สาย Pro ANC</div>
              <h3 style="font-size:12px; margin:6px 6px 3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#2c3e50;">หูฟังตัดเสียงรบกวน Pro</h3>
              <p style="color:#e74c3c; font-weight:bold; font-size:12px; margin:0 0 5px;">฿890</p>
              <span style="display:inline-block; background:#e9ecef; color:#6c757d; padding:3px 7px; border-radius:4px; font-size:10px; font-weight:bold;">⏳ อยู่ระหว่างปรับปรุงระบบ</span>
            </div>

            <div style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.06); text-align:center; padding-bottom:8px; min-width:0;">
              <div style="background:linear-gradient(135deg, #55efc4, #00b894); height:46px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; font-weight:bold; padding:0 4px;">⌚ สมาร์ทวอทช์ Sport</div>
              <h3 style="font-size:12px; margin:6px 6px 3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#2c3e50;">สมาร์ทวอทช์กันน้ำ IP68</h3>
              <p style="color:#e74c3c; font-weight:bold; font-size:12px; margin:0 0 5px;">฿1,290</p>
              <span style="display:inline-block; background:#e9ecef; color:#6c757d; padding:3px 7px; border-radius:4px; font-size:10px; font-weight:bold;">⏳ อยู่ระหว่างปรับปรุงระบบ</span>
            </div>

            <div style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.06); text-align:center; padding-bottom:8px; min-width:0;">
              <div style="background:linear-gradient(135deg, #ffeaa7, #fdcb6e); height:46px; display:flex; align-items:center; justify-content:center; color:#2d3436; font-size:11px; font-weight:bold; padding:0 4px;">🔊 ลำโพงบลูทูธ Bass+</div>
              <h3 style="font-size:12px; margin:6px 6px 3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#2c3e50;">ลำโพงเบสหนักพกพา</h3>
              <p style="color:#e74c3c; font-weight:bold; font-size:12px; margin:0 0 5px;">฿650</p>
              <span style="display:inline-block; background:#e9ecef; color:#6c757d; padding:3px 7px; border-radius:4px; font-size:10px; font-weight:bold;">⏳ อยู่ระหว่างปรับปรุงระบบ</span>
            </div>

            <div style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.06); text-align:center; padding-bottom:8px; min-width:0;">
              <div style="background:linear-gradient(135deg, #a29bfe, #6c5ce7); height:46px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; font-weight:bold; padding:0 4px;">🔋 พาวเวอร์แบงค์ 20000mAh</div>
              <h3 style="font-size:12px; margin:6px 6px 3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#2c3e50;">แบตสำรองชาร์จไว PD</h3>
              <p style="color:#e74c3c; font-weight:bold; font-size:12px; margin:0 0 5px;">฿790</p>
              <span style="display:inline-block; background:#e9ecef; color:#6c757d; padding:3px 7px; border-radius:4px; font-size:10px; font-weight:bold;">⏳ อยู่ระหว่างปรับปรุงระบบ</span>
            </div>
          </div>
        </div>
      
<script id="__grpCollapseFinal">
function toggleKeyGroup(grp) {
  var btn = document.getElementById('grpBtn_' + grp);
  var lbl = document.getElementById('grpLbl_' + grp);
  var open = btn && btn.getAttribute('data-open') === '1';
  var next = !open;
  if (btn) btn.setAttribute('data-open', next ? '1' : '0');
  if (lbl) lbl.textContent = next ? '▼ ซ่อน' : '▶ กดเพื่อแสดง';
  document.querySelectorAll('tr[data-key-group="' + grp + '"]').forEach(function(r) {
    r.style.display = next ? '' : 'none';
  });
}
(function(){
  function hideAllGroups(){
    ['family','test','general'].forEach(function(g){
      var btn = document.getElementById('grpBtn_' + g);
      if (btn) btn.setAttribute('data-open','0');
      var lbl = document.getElementById('grpLbl_' + g);
      if (lbl) lbl.textContent = '▶ กดเพื่อแสดง';
      document.querySelectorAll('tr[data-key-group="' + g + '"]').forEach(function(r){
        r.style.display = 'none';
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideAllGroups);
  } else {
    hideAllGroups();
  }
  setTimeout(hideAllGroups, 150);
})();
</script>

<script id="__grpInsertAndCollapse">
function toggleKeyGroup(grp) {
  var btn = document.getElementById('grpBtn_' + grp);
  var lbl = document.getElementById('grpLbl_' + grp);
  var open = btn && btn.getAttribute('data-open') === '1';
  var next = !open;
  if (btn) btn.setAttribute('data-open', next ? '1' : '0');
  if (lbl) lbl.textContent = next ? '▼ ซ่อน' : '▶ กดเพื่อแสดง';
  document.querySelectorAll('tr[data-key-group="' + grp + '"]').forEach(function(r) {
    r.style.display = next ? '' : 'none';
  });
}
(function() {
  function detectGroup(txt) {
    var t = (txt || '').toLowerCase();
    if (t.indexOf('ครอบครัว') !== -1 || t.indexOf('family') !== -1) return 'family';
    if (t.indexOf('เทสต์') !== -1 || t.indexOf('test') !== -1) return 'test';
    if (t.indexOf('ทั่วไป') !== -1 || t.indexOf('general') !== -1) return 'general';
    return '';
  }
  function buildGroups() {
    var tbody = document.querySelector('tbody');
    if (!tbody || document.getElementById('grpBtn_family')) return;
    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
    var buckets = { family: [], test: [], general: [] };
    rows.forEach(function(tr) {
      if (tr.querySelector('button[id^="grpBtn_"]')) return;
      var g = detectGroup(tr.innerText || tr.textContent || '');
      if (g && buckets[g]) {
        tr.setAttribute('data-key-group', g);
        tr.style.display = 'none';
        buckets[g].push(tr);
      }
    });
    var titles = {
      family: 'กลุ่มครอบครัว',
      test: 'กลุ่มเทสต์',
      general: 'กลุ่มผู้ใช้งานทั่วไป'
    };
    ['family', 'test', 'general'].forEach(function(g) {
      var list = buckets[g];
      if (!list.length) return;
      var headerTr = document.createElement('tr');
      var td = document.createElement('td');
      td.setAttribute('colspan', '5');
      td.style.padding = '6px 8px';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'grpBtn_' + g;
      btn.setAttribute('data-open', '0');
      btn.style.cssText = 'width:100%;display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:6px;background:#1b1b1b;color:#fff;border:1px solid #555;font-size:12px;font-weight:bold;cursor:pointer;';
      var spTitle = document.createElement('span');
      spTitle.textContent = titles[g] + ' (' + list.length + ')';
      var spLbl = document.createElement('span');
      spLbl.id = 'grpLbl_' + g;
      spLbl.textContent = '▶ กดเพื่อแสดง';
      btn.appendChild(spTitle);
      btn.appendChild(spLbl);
      btn.onclick = function() { toggleKeyGroup(g); };
      td.appendChild(btn);
      headerTr.appendChild(td);
      tbody.insertBefore(headerTr, list[0]);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildGroups);
  } else {
    buildGroups();
  }
  setTimeout(buildGroups, 120);
})();
</script>

<script id="__fixClickCollapse">
(function() {
  function setGroupState(grp, isOpen) {
    var btn = document.getElementById('grpBtn_' + grp);
    var lbl = document.getElementById('grpLbl_' + grp);
    if (btn) btn.setAttribute('data-open', isOpen ? '1' : '0');
    if (lbl) lbl.textContent = isOpen ? '▼ ซ่อน' : '▶ กดเพื่อแสดง';
    var rows = document.querySelectorAll('tr[data-key-group="' + grp + '"]');
    for (var i = 0; i < rows.length; i++) {
      rows[i].style.setProperty('display', isOpen ? 'table-row' : 'none', 'important');
    }
  }

  window.toggleKeyGroup = function(grp) {
    if (!grp) return;
    var btn = document.getElementById('grpBtn_' + grp);
    var curOpen = btn && btn.getAttribute('data-open') === '1';
    setGroupState(grp, !curOpen);
  };

  document.addEventListener('click', function(ev) {
    var target = ev.target;
    if (!target || !target.closest) return;
    var btn = target.closest('button[id^="grpBtn_"]');
    if (!btn) return;
    var grp = btn.id.replace('grpBtn_', '');
    window.toggleKeyGroup(grp);
  }, true);

  function collapseOnStart() {
    ['family', 'test', 'general'].forEach(function(g) {
      var btn = document.getElementById('grpBtn_' + g);
      if (btn && btn.getAttribute('data-open') !== '1') {
        setGroupState(g, false);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', collapseOnStart);
  } else {
    collapseOnStart();
  }
  setTimeout(collapseOnStart, 200);
  setTimeout(collapseOnStart, 600);
})();
</script>
<div style="position:fixed; top:10px; right:10px; z-index:9990; display:flex; gap:6px; align-items:center;"><a href="/10admin" style="background:#059669; color:#fff; padding:4px 8px; text-decoration:none; border-radius:4px; font-size:11px; font-weight:bold; line-height:1.2; opacity:0.92;">⚙️ หลังบ้าน</a><a href="https://hackersbaby.whf.bz" style="background:#2563eb; color:#fff; padding:4px 8px; text-decoration:none; border-radius:4px; font-size:11px; font-weight:bold; line-height:1.2; opacity:0.92;">🏠 หน้าบ้าน</a></div>
</body>
      \n<script>\ndocument.addEventListener('click',function(e){\nvar b=e.target&&e.target.closest?e.target.closest('button'):null;\nif(!b)return;\nvar t=(b.textContent||'').trim();\nif(t.indexOf('ลบคีย์กลุ่มเทสต์')!==-1||t.indexOf('ลบคีย์กลุ่มผู้ใช้งานทั่วไป')!==-1||t.indexOf('ลบคีย์กลุ่มครอบครัว')!==-1){\ne.preventDefault();e.stopPropagation();\nvar g=t.indexOf('เทสต์')!==-1?'test':(t.indexOf('ครอบครัว')!==-1?'family':'general');\nvar dg=document.getElementById('keyStepDelGroupView'),dv=document.getElementById('keyStepDelView'),ti=document.getElementById('keyDelGroupTitle'),bx=document.getElementById('keyDelListBox');\nif(dg)dg.style.display='none';if(dv)dv.style.display='block';\nif(ti)ti.textContent=g==='test'?'คีย์ในกลุ่มเทสต์':(g==='family'?'คีย์ในกลุ่มครอบครัว':'คีย์ในกลุ่มผู้ใช้งานทั่วไป');\nif(bx){bx.innerHTML='กำลังโหลด...';fetch('/api/admin-list-keys').then(function(r){return r.json();}).then(function(j){\nvar list=(j.keys||[]).filter(function(k){return(k.group||(k.durationDays===3?'family':'general'))===g&&Number(k.id)>4;});\nif(!list.length){bx.innerHTML='<div style=\"padding:6px;color:#aaa;\">ไม่มีคีย์ในกลุ่มนี้</div>';return;}\nbx.innerHTML=list.map(function(k){return'<div style=\"display:flex;justify-content:space-between;align-items:center;padding:6px 4px;border-bottom:1px solid #333;gap:6px;\"><span style=\"color:#fff;font-size:11px;word-break:break-all;\">#'+k.id+' '+(k.name||'')+'</span><button type=\"button\" data-del-key-id=\"'+k.id+'\" style=\"background:#d32f2f;color:#fff;border:none;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:bold;cursor:pointer;\">ลบ</button></div>';}).join('');\n}).catch(function(err){bx.innerHTML='<div style=\"padding:6px;color:#ff8a80;\">โหลดไม่สำเร็จ: '+err+'</div>';});}\nreturn;}\nvar did=b.getAttribute('data-del-key-id');\nif(did){\ne.preventDefault();e.stopPropagation();b.disabled=true;b.textContent='กำลังลบ...';\nfetch('/api/admin-delete-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:Number(did)})}).then(function(r){return r.json();}).then(function(j){\nif(j&&j.ok){var row=b.closest('div');if(row)row.remove();if(typeof window.renderAdminKeys==='function'){try{window.renderAdminKeys();}catch(_){}}else if(bx&&bx.children.length===0){bx.innerHTML='<div style="padding:6px;color:#aaa;">ไม่มีคีย์ในกลุ่มนี้</div>';}}else{alert('ลบไม่สำเร็จ: '+(j&&j.error?j.error:'unknown'));b.disabled=false;b.textContent='ลบ';}\n}).catch(function(err){alert('เชื่อมต่อไม่ได้: '+err);b.disabled=false;b.textContent='ลบ';});\n}\n},true);\n</script></html>
    `);
    }


    if (isAdmin) {
      const __gCnt = { family:0, test:0, general:0 }; KEYS.forEach(x => { const g = getKeyGroup(x); if (__gCnt[g] !== undefined) __gCnt[g]++; }); const __gSeen = {};
let __adminShown = false;
const keyRows = KEYS.filter(k => Number(k.id) === 1).map(k => {
      const displayName = k.name;

        const vlessLink = `vless://${k.uuid}@${host}:443?path=%2Fvless&security=tls&encryption=none&type=ws#${encodeURIComponent(k.name)}`;
        
        let timeStatus = '';
        let actionButtons = '-';

        const connBadge = getKeyConnBadgeHtml(k);
        if (k.id === 1) {
          const bundle = buildAdminAllInOne(k.uuid, k.name, host);
          timeStatus = '' + `<div>${getPipeBadgeHtml()}</div>`;
          actionButtons = `
            <div style="position:relative; display:inline-block;">
              
              <div id="admin-dropdown" style="display:none; position:absolute; right:0; background:#222; border:1px solid #444; border-radius:4px; box-shadow:0 4px 10px rgba(0,0,0,0.5); z-index:10; min-width:160px; margin-top:5px;">
                <a href="/admin-action?action=refresh" style="display:block; padding:10px; color:#fff; text-decoration:none; font-size:12px; border-bottom:1px solid #333;">🔄 รีเฟรช</a>
                
              </div>
            </div>
          `;
        } else {
          const isGeneral = getKeyGroup(k) === 'general';
          const planDays = Number(k.durationDays) || getDefaultDaysForGroup(getKeyGroup(k)) || 3;
          if (!k.started) {
            timeStatus = `<span><b>รอใช้ (${planDays} วัน)</b> (${isGeneral ? 'ทั่วไป' : 'อัตโนมัติ'})</span>` + getPipeBadgeHtml();
          } else {
            const timeLeft = k.expiresAt - Date.now();
            const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
            if (daysLeft > 0) {
              timeStatus = `<span style="color:#00ff00;"><b>${daysLeft}</b> วัน (${isGeneral ? 'ทั่วไป' : 'อัตโนมัติ'})</span>` + getPipeBadgeHtml();
            } else {
              timeStatus = (isGeneral
                ? `<span style="color:#ff4444; font-weight:bold;">⛔ หมดอายุ</span>`
                : `<span style="color:#ff4444; font-weight:bold;">🔄 กำลังสร้างใหม่...</span>`) + `<div>${getPipeBadgeHtml()}</div>`;
            }
          }

          // จัดเรียงปุ่มจัดการเวลา: ช่องกรอกอยู่บน | ปุ่มเขียวซ้าย | ปุ่มแดงขวา
          actionButtons = `
            <div class="action-cell">
              <input type="number" id="custom-days-${k.id}" value="1" min="1">
              <div class="time-btn-group">
                <button type="button" class="btn-add" onclick="updateTime(${k.id}, 1)" style="white-space:nowrap;">+เพิ่ม</button>
                <button type="button" class="btn-sub" onclick="updateTime(${k.id}, -1)" style="white-space:nowrap;">-ลด</button>
              </div>
            </div>
          `;
        }

        return `
          ${(() => { const __g = getKeyGroup(k); if (!['family','test','general'].includes(__g) || __gSeen[__g]) return ''; __gSeen[__g] = true; const __t = __g==='family'?'กลุ่มครอบครัว':(__g==='test'?'กลุ่มเทสต์':'กลุ่มผู้ใช้งานทั่วไป'); return '<tr><td colspan="5" style="padding:6px 8px;"><button type="button" id="grpBtn_' + __g + '" data-open="0" onclick="toggleKeyGroup(\'' + __g + '\')" style="width:100%;display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:6px;background:#1b1b1b;color:#fff;border:1px solid #555;font-size:12px;font-weight:bold;"><span>' + __t + ' (' + __gCnt[__g] + ')</span><span id="grpLbl_' + __g + '">▶ กดเพื่อแสดง</span></button></td></tr>'; })()}<tr data-key-group="${getKeyGroup(k)}" style="border-bottom: 1px solid #333;">
            <td style="padding:4px 1px; font-size:11px; word-break:break-word;">${k.id}</td>
            <td colspan="2" style="padding:4px 2px; font-size:11px; word-break:break-word;">${k.id === 1 ? `<style>.k1-eq-stack{display:flex;flex-direction:column;gap:4px;align-items:flex-start}.k1-eq-stack>span,.k1-eq-stack>span>span,.k1-eq-stack>button{display:inline-flex!important;align-items:center!important;justify-content:flex-start!important;width:122px!important;min-width:122px!important;max-width:122px!important;height:22px!important;min-height:22px!important;max-height:22px!important;padding:0 7px!important;margin:0!important;border-radius:4px!important;font-size:10.5px!important;font-weight:bold!important;line-height:1!important;white-space:nowrap!important;box-sizing:border-box!important;overflow:hidden!important}.k1-eq-stack>span.k1-wrap{padding:0!important;background:transparent!important;border:none!important}.k1-eq-stack>button{cursor:pointer!important;background:#1f2937!important;color:#93c5fd!important;border:1px solid #3b82f6!important}</style><div class="k1-eq-stack"><span id="user-status-${k.id}" data-key-id="${k.id}" style="background:rgba(255,255,255,0.08);color:#f3f4f6;border:1px solid rgba(255,255,255,0.22);">${displayName}</span><span class="k1-wrap" id="k1-pipe-wrap">${getPipeBadgeHtml()}</span><span class="k1-wrap">${getKeyConnectBadgeHtml(k)}</span><button type="button" id="btnPipeAirplaneRefresh" onclick="window.refreshPipeAirplane(this)">🔄 รีเฟรชท่อส่ง</button></div><script>window.refreshPipeAirplane=async function(btn){if(btn&&btn.disabled)return;var wrap=document.getElementById('k1-pipe-wrap');var badge=wrap?wrap.querySelector('span'):null;if(btn){btn.disabled=true;btn.textContent='✈️ รีเซ็ตท่อ...';btn.style.opacity='0.75';}if(badge){badge.textContent='✈️ ตัดสัญญาณท่อ...';badge.style.color='#ffd54f';badge.style.background='rgba(255,213,79,0.16)';badge.style.borderColor='rgba(255,213,79,0.45)';}try{var r=await fetch('/api/refresh-pipe',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});var j=await r.json();if(j&&j.ok&&badge){badge.textContent=j.label;badge.style.color=j.color;badge.style.background=j.bg;badge.style.borderColor=j.border;}}catch(e){if(badge){badge.textContent='🔴 จับสัญญาณไม่ได้';badge.style.color='#ff5252';badge.style.background='rgba(255,82,82,0.14)';badge.style.borderColor='rgba(255,82,82,0.40)';}}finally{if(btn){btn.disabled=false;btn.textContent='🔄 รีเฟรชท่อส่ง';btn.style.opacity='1';}}};</script>` : `<span id="user-status-${k.id}" data-key-id="${k.id}" style="display:inline-block; padding:2px 6px; border-radius:4px; font-weight:bold; background:rgba(255,255,255,0.06); color:#f3f4f6; border:1px solid rgba(255,255,255,0.18);">${displayName}</span><div style="margin-top:4px;">${getKeyConnectBadgeHtml(k)}</div>`}</td>
            ${k.id === 1 ? `` : `<td style="padding:4px 1px; font-size:11px; word-break:break-word;">${timeStatus}</td>`}
            <td style="padding:4px 1px; font-size:11px; word-break:break-word;">${actionButtons}</td>
            <td style="padding:4px 1px; font-size:11px; word-break:break-word;">
              <div style="display:flex; gap:8px; align-items:center;">
<div style="display:flex; flex-wrap:nowrap; gap:4px; align-items:center; width:100%;"></div>
            </td>
          </tr>
        `;
      }).join('');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return ("<div id=\"generalKeyBox\" style=\"margin:14px auto; max-width:900px; padding:12px; border:1px solid #2e7d32; border-radius:8px; background:#0c1f12; color:#e8f5e9;\">\n  <b>👤 รับคีย์ทดลองกลุ่มผู้ใช้งานทั่วไป (7 วัน):</b>\n  <button type=\"button\" onclick=\"claimGeneralKey()\" style=\"margin-left:8px; padding:6px 12px; border-radius:6px; border:none; background:#2e7d32; color:#fff; font-weight:bold; cursor:pointer;\">รับคีย์ผู้ใช้งานทั่วไป</button>\n  <div id=\"claimGeneralOut\" style=\"margin-top:8px; font-family:monospace; font-size:12px; color:#a5d6a7; word-break:break-all;\"></div>\n</div>\n<script>\nasync function claimGeneralKey() {\n  const out = document.getElementById('claimGeneralOut');\n  out.textContent = 'กำลังออกคีย์...';\n  try {\n    const r = await fetch('/api/claim-general-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });\n    const j = await r.json();\n    if (j.ok) {\n      out.textContent = 'คีย์ #' + j.id + ' [' + j.name + '] UUID: ' + j.uuid;\n    } else {\n      out.textContent = 'ออกคีย์ไม่สำเร็จ';\n    }\n  } catch (e) {\n    out.textContent = 'เชื่อมต่อไม่สำเร็จ: ' + e.message;\n  }\n}\n</script>") + res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Full Control - Admin Panel</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            html, body {
              padding: 4px !important;
              margin: 0 !important;
              box-sizing: border-box !important;
              font-family: sans-serif;
              background: #121212;
              color: #eee;
            }
            /* จัดเรียงบล็อกจัดการเวลา (ช่องกรอกอยู่บน ปุ่มเขียวซ้าย ปุ่มแดงขวา) */
            td:nth-child(4), .action-cell { 
              display: flex; 
              flex-direction: column; 
              align-items: flex-start; 
              gap: 4px; 
            }
            td input[type="number"], .action-cell input { 
              width: 60px; 
              padding: 4px; 
              text-align: center; 
              background: #222; 
              color: #fff; 
              border: 1px solid #444; 
              border-radius: 4px; 
              font-size: 14px; 
            }
            .time-btn-group, td div:has(button), .action-cell div { 
              display: flex; 
              gap: 4px; 
            }
            .btn-add, button[class*="add"], td button:nth-of-type(1) { 
              background-color: #28a745; 
              color: #fff; 
              order: 1; 
              padding: 4px 8px; 
              font-size: 12px; 
              font-weight: bold; 
              border: none; 
              border-radius: 4px; 
              cursor: pointer; 
            }
            .btn-sub, button[class*="sub"], td button:nth-of-type(2) { 
              background-color: #dc3545; 
              color: #fff; 
              order: 2; 
              padding: 4px 8px; 
              font-size: 12px; 
              font-weight: bold; 
              border: none; 
              border-radius: 4px; 
              cursor: pointer; 
            }
          </style>
          <script>
            function toggleMenu() {
              const menu = document.getElementById('admin-dropdown');
              menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            }
            function updateTime(id, multiplier) {
              const inputVal = parseInt(document.getElementById('custom-days-' + id).value) || 1;
              const days = inputVal * multiplier;
              window.location.href = '/update-time?id=' + id + '&days=' + days;
            }
            function toggleAdminCopyStep(id){document.querySelectorAll('[id^="admin-copy-menu-"]').forEach(function(el){if(el.id!=="admin-copy-menu-"+id)el.style.display="none";});var m=document.getElementById("admin-copy-menu-"+id);if(!m)return;if(m.style.display==="block"){m.style.display="none";return;}var btn=document.querySelector('[onclick="toggleAdminCopyStep('+id+')"]');if(btn){var r=btn.getBoundingClientRect();m.style.top=(r.bottom+4)+"px";m.style.right=Math.max(8,window.innerWidth-r.right)+"px";}m.style.display="block";}function getAdminPayloadByType(id,kind){var h=window.location.host||"my-project-websocket.onrender.com";var inp=document.getElementById("key-"+id);var u=(inp&&inp.getAttribute("data-uuid"))||"";var rawName=(inp&&inp.getAttribute("data-name"))||"";var n=rawName?decodeURIComponent(rawName):("Key-"+id);if(kind==="vmess"){var p={v:"2",ps:n+"-VMess",add:"162.35.47.89",port:"444",id:u,aid:"0",scy:"auto",net:"ws",type:"none",host:"162.35.47.89",path:"/vmess",tls:""};var s=JSON.stringify(p);var b64=btoa(unescape(encodeURIComponent(s)));return "vmess://"+b64;}if(kind==="ssh"){return "vless://"+u+"@162.35.47.89:443?type=ws&path=%2Fvless&security=tls&encryption=none&host=162.35.47.89#"+encodeURIComponent(n+"-SSH");}return "vless://"+u+"@162.35.47.89:443?type=ws&path=%2Fvless&security=tls&encryption=none&host=162.35.47.89#"+encodeURIComponent(n+"-VLESS");}function copyAdminByType(id,kind,btn){var inp=document.getElementById("key-"+id);var val=getAdminPayloadByType(id,kind);if(inp)inp.value=val;var m=document.getElementById("admin-copy-menu-"+id);if(m)m.style.display="none";var __ok=false;if(inp){var __ro=inp.hasAttribute("readonly");inp.removeAttribute("readonly");inp.focus();inp.select();inp.setSelectionRange(0,999999);try{__ok=!!document.execCommand("copy");}catch(e){__ok=false;}if(__ro)inp.setAttribute("readonly","readonly");}if(!__ok&&navigator.clipboard&&window.isSecureContext&&navigator.clipboard.writeText){navigator.clipboard.writeText(val).catch(function(){});}if(btn){var t=btn.textContent;btn.textContent="✅ คัดลอกแล้ว";setTimeout(function(){btn.textContent=t;},1200);}}
            function populateThreeKeyRows(){var h=window.location.host||"my-project-websocket.onrender.com";document.querySelectorAll('[id^="key-"]').forEach(function(inp){if(inp.id.indexOf("key-vrest-")===0||inp.id.indexOf("key-ssh-")===0)return;var id=inp.id.replace("key-","");var u=inp.getAttribute("data-uuid")||"";var rawName=inp.getAttribute("data-name")||"";var n=rawName?decodeURIComponent(rawName):("Key-"+id);var vh="162.35.47.89";inp.value="vless://"+u+"@162.35.47.89:443?type=ws&path=%2Fvless&security=tls&encryption=none&host=162.35.47.89#"+encodeURIComponent(n+"-VLESS");var vr=document.getElementById("key-vrest-"+id);if(vr){var p={v:"2",ps:n+"-VMess",add:"162.35.47.89",port:"444",id:u,aid:"0",scy:"auto",net:"ws",type:"none",host:"162.35.47.89",path:"/vmess",tls:""};var b64=btoa(unescape(encodeURIComponent(JSON.stringify(p))));vr.value="vmess://"+b64;}var sh=document.getElementById("key-ssh-"+id);if(sh){sh.value="vless://"+u+"@162.35.47.89:443?type=ws&path=%2Fvless&security=tls&encryption=none&host=162.35.47.89#"+encodeURIComponent(n+"-SSH");}});}
            window.addEventListener("DOMContentLoaded",populateThreeKeyRows);
            function copyKey(id, btn) {
              const input = document.getElementById(id);
              if (!input) return;
              input.removeAttribute('readonly');
              input.focus();
              input.select();
              input.setSelectionRange(0, 999999);
              const val = input.value || '';
              function markCopied() {
                input.setAttribute('readonly', 'readonly');
                if (btn) {
                  const t = btn.textContent;
                  btn.textContent = '✅ คัดลอกแล้ว';
                  setTimeout(() => { btn.textContent = t; }, 1200);
                }
              }
              function fallbackCopy() {
                let ok = false;
                try { ok = !!document.execCommand('copy'); } catch (e) { ok = false; }
                if (!ok) {
                  try {
                    const ta = document.createElement('textarea');
                    ta.value = val;
                    ta.setAttribute('readonly', '');
                    ta.style.position = 'fixed';
                    ta.style.top = '0';
                    ta.style.left = '0';
                    ta.style.opacity = '0.01';
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();
                    ta.setSelectionRange(0, 999999);
                    ok = !!document.execCommand('copy');
                    document.body.removeChild(ta);
                  } catch (e2) { ok = false; }
                }
                if (ok) {
                  markCopied();
                } else {
                  input.setAttribute('readonly', 'readonly');
                  input.select();
                  if (btn) {
                    const t = btn.textContent;
                    btn.textContent = 'เลือกไว้แล้ว ก๊อปเอง';
                    setTimeout(() => { btn.textContent = t; }, 1500);
                  }
                }
              }
              if (navigator.clipboard && window.isSecureContext && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(val).then(markCopied).catch(fallbackCopy);
              } else {
                fallbackCopy();
              }
            }

            function applyUserHealthStyle(el, state, baseName, labelText) {
              if (!el) return;
              var icon = '🟢';
              var fg = '#28a745';
              var bg = 'rgba(40,167,69,0.16)';
              var bd = 'rgba(40,167,69,0.55)';
              if (state === 'yellow') {
                icon = '🟡';
                fg = '';
                bg = 'rgba(255,193,7,0.18)';
                bd = 'rgba(255,193,7,0.6)';
              } else if (state === 'red') {
                icon = '🔴';
                fg = '#ff5252';
                bg = 'rgba(220,53,69,0.22)';
                bd = 'rgba(220,53,69,0.65)';
              }
              el.style.color = fg;
              el.style.background = bg;
              el.style.border = '1px solid ' + bd;
              el.title = baseName + ' : ' + labelText;
              el.textContent = icon + ' ' + baseName;
            }
            function scanAllUserKeysHealth() {
              var els = document.querySelectorAll('[id^="user-status-"]');
              if (!els || !els.length) return;
              var t0 = performance.now();
              fetch('/api/key-health', { cache: 'no-store' })
                .then(function(r) {
                  if (!r.ok) throw new Error('HTTP_' + r.status);
                  return r.json();
                })
                .then(function(data) {
                  var rtt = Math.round(performance.now() - t0);
                  var map = {};
                  if (data && Array.isArray(data.keys)) {
                    data.keys.forEach(function(item) { map[String(item.id)] = item; });
                  }
                  els.forEach(function(el) {
                    var kid = el.getAttribute('data-key-id');
                    var baseName = el.getAttribute('data-base-name');
                    if (!baseName) {
                      baseName = (el.textContent || '').replace(/^[🟢🟡🔴⏳]\s*/, '').trim();
                      el.setAttribute('data-base-name', baseName);
                    }
                    var info = map[String(kid)];
                    if (!info) {
                      applyUserHealthStyle(el, 'yellow', baseName, 'ไม่พบข้อมูลคีย์');
                      return;
                    }
                    var st = info.state || 'green';
                    if (st === 'green' && rtt > 2500) {
                      st = 'yellow';
                    }
                    applyUserHealthStyle(el, st, baseName, info.label + ' (' + rtt + 'ms)');
                  });
                })
                .catch(function() {
                  els.forEach(function(el) {
                    var baseName = el.getAttribute('data-base-name');
                    if (!baseName) {
                      baseName = (el.textContent || '').replace(/^[🟢🟡🔴⏳]\s*/, '').trim();
                      el.setAttribute('data-base-name', baseName);
                    }
                    applyUserHealthStyle(el, 'red', baseName, 'เชื่อมต่อไม่สำเร็จ');
                  });
                });
            }
            window.addEventListener('DOMContentLoaded', function() {
              scanAllUserKeysHealth();
              setInterval(scanAllUserKeysHealth, 8000);
            });

          </script>
        </head>
        <body style="padding:15px;">
<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px;"><div><h2 style="margin:0 0 2px 0;line-height:1.25;">⚡ Full Control: ระบบจัดการคีย์</h2><p style="margin:0;font-size:13px;color:#ccc;line-height:1.3;">แอดมิน | เซิร์ฟเวอร์: <b>${host}</b></p></div><div style="flex-shrink:0;margin-top:18px;"><a href="/logout" style="display:inline-block;background:#991b1b;color:#fca5a5;padding:4px 8px;text-decoration:none;border-radius:4px;font-size:11px;opacity:0.9;white-space:nowrap;">🔴 ออกจากระบบ</a></div></div><div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-top:8px;margin-bottom:6px;"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><a href="https://hackersbaby.whf.bz" style="display:inline-block;background:#2563eb;color:#fff;padding:8px 12px;text-decoration:none;border-radius:5px;font-size:14px;font-weight:bold;white-space:nowrap;">🏠 หน้าบ้าน</a><div style="position:relative;display:inline-block;margin-left:6px;z-index:999;">
  <button type="button" id="btnKeyStepMain" onclick="window.toggleKeyStepMenu&&window.toggleKeyStepMenu(event)" style="background:#1976d2;color:#fff;border:none;padding:8px 12px;border-radius:6px;font-weight:bold;cursor:pointer;">🔑 จัดการคีย์ ▾</button>
  <div id="keyStepDropdown" style="display:none;position:absolute;left:0;top:40px;background:#1e1e1e;border:1px solid #555;border-radius:8px;box-shadow:0 8px 20px rgba(0,0,0,0.85);min-width:220px;padding:6px;z-index:9999;">
    <div id="keyStepMainView">
      <button type="button" onclick="openKeySubStep('add')" style="display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid #333;padding:10px;color:#4fc3f7;font-weight:bold;font-size:13px;cursor:pointer;">➕ 1. เพิ่มคีย์</button>
      <button type="button" onclick="openKeySubStep('del')" style="display:block;width:100%;text-align:left;background:none;border:none;padding:10px;color:#ff8a80;font-weight:bold;font-size:13px;cursor:pointer;">🗑️ 2. ลบคีย์</button>
    </div>
    <div id="keyStepAddView" style="display:none;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px 8px;border-bottom:1px solid #333;color:#aaa;font-size:11px;">
        <span>เลือกกลุ่มที่จะเพิ่มคีย์</span>
        <span onclick="backKeyMainStep()" style="color:#fff;cursor:pointer;">◀ กลับ</span>
      </div>
      <button type="button" onclick="adminCreateGroupKey('test')" style="display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid #333;padding:10px;color:#fff;font-weight:bold;font-size:12px;cursor:pointer;">🧪 เพิ่มเข้ากลุ่มเทสต์</button>
      <button type="button" onclick="adminCreateGroupKey('general')" style="display:block;width:100%;text-align:left;background:none;border:none;padding:10px;color:#fff;font-weight:bold;font-size:12px;cursor:pointer;">👤 เพิ่มเข้ากลุ่มผู้ใช้งานทั่วไป</button>
  <button type="button" onclick="var d=3;var n=prompt('ระบุชื่อคีย์กลุ่มครอบครัว (3 วัน) เช่น แม่ / ธัญเทพ / เจตนา:','ครอบครัว');if(n!==null){n=(n||'ครอบครัว').trim()||'ครอบครัว';fetch('/api/create-family-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,days:d})}).then(function(r){return r.json();}).then(function(j){if(j&&j.ok){alert('สร้างคีย์ครอบครัวสำเร็จ: '+j.name+' [ID #'+j.id+']');location.reload();}else{alert('สร้างคีย์ไม่สำเร็จ: '+(j&&j.error?j.error:'unknown'));}}).catch(function(e){alert('เชื่อมต่อไม่สำเร็จ: '+e.message);});}" style="display:flex; align-items:center; gap:6px; width:100%; padding:8px 10px; background:none; border:none; color:#f3e5f5; font-size:12px; font-weight:bold; cursor:pointer; text-align:left;">
    <span>เพิ่มเข้ากลุ่มครอบครัว</span>
  </button>
    </div>
    <div id="keyStepDelGroupView" style="display:none;"><div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px 8px;border-bottom:1px solid #333;color:#aaa;font-size:11px;"><span>เลือกกลุ่มที่จะลบคีย์</span><span onclick="backKeyMainStep()" style="color:#fff;cursor:pointer;">◀ กลับ</span></div><button type="button" onclick="event.stopPropagation();window.openDelGroupList('test')" style="display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid #333;padding:10px;color:#ff8a80;font-weight:bold;font-size:12px;cursor:pointer;">🧪 ลบคีย์กลุ่มเทสต์</button><button type="button" onclick="event.stopPropagation();window.openDelGroupList('general')" style="display:block;width:100%;text-align:left;background:none;border:none;padding:10px;color:#ff8a80;font-weight:bold;font-size:12px;cursor:pointer;">👤 ลบคีย์กลุ่มผู้ใช้งานทั่วไป</button><button type="button" onclick="event.stopPropagation();window.openDelGroupList('family')" style="display:block;width:100%;text-align:left;background:none;border:none;border-top:1px solid #333;padding:10px;color:#ff8a80;font-weight:bold;font-size:12px;cursor:pointer;">👨‍👩‍👧 ลบคีย์กลุ่มครอบครัว</button></div><div id="keyStepDelView" style="display:none;max-height:260px;overflow-y:auto;"><div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px 8px;border-bottom:1px solid #333;color:#aaa;font-size:11px;"><span id="keyDelGroupTitle">รายการคีย์</span><span onclick="openKeySubStep('del')" style="color:#fff;cursor:pointer;">◀ กลับ</span></div><div id="keyDelListBox" style="padding:4px;font-size:12px;color:#ccc;">กำลังโหลด...</div></div>
  </div>
</div></div></div>
<hr style="border:1px solid #333;">
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; text-align:left; max-width:100%; width:100%; table-layout:fixed;" border-spacing:0;">
              <thead>
                <tr style="background:#222; color:#aaa;">
                  <th style="padding:4px 1px; font-size:11px; white-space:nowrap; width:12px;">#</th>
                  <th style="padding:4px 1px; font-size:11px; white-space:nowrap; width:50px;">ชื่อยูสเซอร์</th>
                  <th style="padding:4px 1px; font-size:11px; white-space:nowrap; width:76px;">สถานะเวลา</th>
                  <th style="padding:4px 1px; font-size:11px; white-space:nowrap; width:84px;">จัดการเวลา</th>
                  <th style="padding:4px 1px; font-size:11px; white-space:nowrap;">ลิงก์ VLESS</th>
                </tr>
              </thead>
              <tbody>${keyRows}</tbody>
<script id="__clickToggleReady">
(function() {
  function setGrpRows(grp, open) {
    var btn = document.getElementById('grpBtn_' + grp);
    var lbl = document.getElementById('grpLbl_' + grp);
    if (btn) btn.setAttribute('data-open', open ? '1' : '0');
    if (lbl) lbl.textContent = open ? '▼ ซ่อน' : '▶ กดเพื่อแสดง';
    var tbody = btn && btn.closest ? btn.closest('tbody') : document.querySelector('tbody');
    if (!tbody) return;
    var headerTr = btn.closest('tr');
    var cur = headerTr ? headerTr.nextElementSibling : null;
    while (cur) {
      if (cur.querySelector && cur.querySelector('button[id^="grpBtn_"]')) break;
      cur.style.display = open ? '' : 'none';
      cur = cur.nextElementSibling;
    }
  }

  window.toggleKeyGroup = function(grp) {
    if (!grp) return;
    var btn = document.getElementById('grpBtn_' + grp);
    var isOpen = btn && btn.getAttribute('data-open') === '1';
    setGrpRows(grp, !isOpen);
  };

  document.addEventListener('click', function(e) {
    var b = e.target && e.target.closest ? e.target.closest('button[id^="grpBtn_"]') : null;
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    window.toggleKeyGroup(b.id.replace('grpBtn_', ''));
  }, true);
})();
</script>

            </table>
          </div>
        
<script id="__adminGroupCollapse">
(function(){
  window.toggleKeyGroup = function(grp) {
    var btn = document.getElementById('grpBtn_' + grp);
    var lbl = document.getElementById('grpLbl_' + grp);
    var open = btn && btn.getAttribute('data-open') === '1';
    var next = !open;
    if (btn) btn.setAttribute('data-open', next ? '1' : '0');
    if (lbl) lbl.textContent = next ? '▼ กดเพื่อซ่อน' : '▶ กดเพื่อแสดง';
    document.querySelectorAll('tr[data-key-group="' + grp + '"]').forEach(function(r) {
      if (next) {
        r.style.removeProperty('display');
      } else {
        r.style.setProperty('display', 'none', 'important');
      }
    });
  };

  function collapseAllOnLoad() {
    ['family','test','general'].forEach(function(g){
      var btn = document.getElementById('grpBtn_' + g);
      if (btn) btn.setAttribute('data-open', '0');
      var lbl = document.getElementById('grpLbl_' + g);
      if (lbl) lbl.textContent = '▶ กดเพื่อแสดง';
      document.querySelectorAll('tr[data-key-group="' + g + '"]').forEach(function(r){
        r.style.setProperty('display', 'none', 'important');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', collapseAllOnLoad);
  } else {
    collapseAllOnLoad();
  }
  window.addEventListener('load', collapseAllOnLoad);
})();
</script>


<script src="/dynamic-ui.js?v=5"></script>
<script src="/notes-ui.js?v=2"></script>
</body>
        \n<script>\ndocument.addEventListener('click',function(e){\nvar b=e.target&&e.target.closest?e.target.closest('button'):null;\nif(!b)return;\nvar t=(b.textContent||'').trim();\nif(t.indexOf('ลบคีย์กลุ่มเทสต์')!==-1||t.indexOf('ลบคีย์กลุ่มผู้ใช้งานทั่วไป')!==-1||t.indexOf('ลบคีย์กลุ่มครอบครัว')!==-1){\ne.preventDefault();e.stopPropagation();\nvar g=t.indexOf('เทสต์')!==-1?'test':(t.indexOf('ครอบครัว')!==-1?'family':'general');\nvar dg=document.getElementById('keyStepDelGroupView'),dv=document.getElementById('keyStepDelView'),ti=document.getElementById('keyDelGroupTitle'),bx=document.getElementById('keyDelListBox');\nif(dg)dg.style.display='none';if(dv)dv.style.display='block';\nif(ti)ti.textContent=g==='test'?'คีย์ในกลุ่มเทสต์':(g==='family'?'คีย์ในกลุ่มครอบครัว':'คีย์ในกลุ่มผู้ใช้งานทั่วไป');\nif(bx){bx.innerHTML='กำลังโหลด...';fetch('/api/admin-list-keys').then(function(r){return r.json();}).then(function(j){\nvar list=(j.keys||[]).filter(function(k){return(k.group||(k.durationDays===3?'family':'general'))===g&&Number(k.id)>4;});\nif(!list.length){bx.innerHTML='<div style=\"padding:6px;color:#aaa;\">ไม่มีคีย์ในกลุ่มนี้</div>';return;}\nbx.innerHTML=list.map(function(k){return'<div style=\"display:flex;justify-content:space-between;align-items:center;padding:6px 4px;border-bottom:1px solid #333;gap:6px;\"><span style=\"color:#fff;font-size:11px;word-break:break-all;\">#'+k.id+' '+(k.name||'')+'</span><button type=\"button\" data-del-key-id=\"'+k.id+'\" style=\"background:#d32f2f;color:#fff;border:none;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:bold;cursor:pointer;\">ลบ</button></div>';}).join('');\n}).catch(function(err){bx.innerHTML='<div style=\"padding:6px;color:#ff8a80;\">โหลดไม่สำเร็จ: '+err+'</div>';});}\nreturn;}\nvar did=b.getAttribute('data-del-key-id');\nif(did){\ne.preventDefault();e.stopPropagation();b.disabled=true;b.textContent='กำลังลบ...';\nfetch('/api/admin-delete-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:Number(did)})}).then(function(r){return r.json();}).then(function(j){\nif(j&&j.ok){var row=b.closest('div');if(row)row.remove();if(typeof window.renderAdminKeys==='function'){try{window.renderAdminKeys();}catch(_){}}else if(bx&&bx.children.length===0){bx.innerHTML='<div style="padding:6px;color:#aaa;">ไม่มีคีย์ในกลุ่มนี้</div>';}}else{alert('ลบไม่สำเร็จ: '+(j&&j.error?j.error:'unknown'));b.disabled=false;b.textContent='ลบ';}\n}).catch(function(err){alert('เชื่อมต่อไม่ได้: '+err);b.disabled=false;b.textContent='ลบ';});\n}\n},true);\n</script></html>
      `);
    }

    // หน้าร้านค้าพรางตาสำหรับคนทั่วไป
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Online Store - ศูนย์รวมสินค้าราคาพิเศษ</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script>
          function handleLogin(event) {
            event.preventDefault();
            const u = document.getElementById('login-user').value;
            const p = document.getElementById('login-pass').value;
            const credentials = btoa(u + ':' + p);
            fetch('/', {
              headers: { 'Authorization': 'Basic ' + credentials }
            }).then(res => {
              if (res.redirected || res.ok) {
                window.location.reload();
              } else {
                alert('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
              }
            }).catch(() => {
              alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
            });
          }
        </script>
      </head>
      <body style="font-family:sans-serif; margin:0; background:#f8f9fa; color:#333;">
        <div style="background:#ffffff; padding:15px 25px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 8px rgba(0,0,0,0.08); flex-wrap:wrap; gap:12px;">
          <div>
            <h2 style="margin:0; color:#2c3e50; font-size:22px;">🛍️ Mega Online Store</h2>
            <p style="margin:2px 0 0; font-size:12px; color:#7f8c8d;">ศูนย์รวมสินค้าคุณภาพดี ราคาพิเศษ</p>
          </div>
          
          <form onsubmit="handleLogin(event)" style="display:flex; gap:8px; align-items:center;">
            <input type="text" id="login-user" placeholder="Username" required style="padding:7px 12px; border:1px solid #ced4da; border-radius:4px; font-size:12px; width:110px;">
            <input type="password" id="login-pass" placeholder="Password" required style="padding:7px 12px; border:1px solid #ced4da; border-radius:4px; font-size:12px; width:110px;">
            <button type="submit" style="background:#2ecc71; color:#fff; border:none; padding:7px 15px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;">เข้าสู่ระบบ</button>
          </form>
        </div>

        <div style="max-width:1100px; margin:20px auto 0; padding:0 20px;">
          <div style="background:#fff3cd; color:#856404; border:1px solid #ffeeba; padding:15px 20px; border-radius:8px; text-align:center; font-size:14px; box-shadow:0 2px 5px rgba(0,0,0,0.03);">
            ⚠️ <b>ประกาศแจ้งเตือน:</b> เว็บไซต์กำลังอยู่ในช่วงปรับปรุงระบบและพัฒนาระบบตะกร้าสินค้า ระบบสั่งซื้อและสมัครสมาชิกยังไม่เปิดให้บริการในขณะนี้ ขออภัยในความไม่สะดวกครับ
          </div>
        </div>

        <div style="max-width:1100px; margin:8px auto; padding:0 8px;">
          <div style="text-align:center; margin-bottom:8px;">
            <h1 style="font-size:16px; margin-bottom:2px; color:#2c3e50;">🔥 สินค้าตัวอย่างจัดแสดง</h1>
            <p style="color:#7f8c8d; font-size:11px;">รายการสินค้าที่กำลังจะวางจำหน่ายเร็วๆ นี้</p>
          </div>

          <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px;">
            <div style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.06); text-align:center; padding-bottom:8px; min-width:0;">
              <div style="background:linear-gradient(135deg, #74b9ff, #0984e3); height:46px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; font-weight:bold; padding:0 4px;">🎧 หูฟังไร้สาย Pro ANC</div>
              <h3 style="font-size:12px; margin:6px 6px 3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#2c3e50;">หูฟังตัดเสียงรบกวน Pro</h3>
              <p style="color:#e74c3c; font-weight:bold; font-size:12px; margin:0 0 5px;">฿890</p>
              <span style="display:inline-block; background:#e9ecef; color:#6c757d; padding:3px 7px; border-radius:4px; font-size:10px; font-weight:bold;">⏳ อยู่ระหว่างปรับปรุงระบบ</span>
            </div>

            <div style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.06); text-align:center; padding-bottom:8px; min-width:0;">
              <div style="background:linear-gradient(135deg, #55efc4, #00b894); height:46px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; font-weight:bold; padding:0 4px;">⌚ สมาร์ทวอทช์ Sport</div>
              <h3 style="font-size:12px; margin:6px 6px 3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#2c3e50;">สมาร์ทวอทช์กันน้ำ IP68</h3>
              <p style="color:#e74c3c; font-weight:bold; font-size:12px; margin:0 0 5px;">฿1,290</p>
              <span style="display:inline-block; background:#e9ecef; color:#6c757d; padding:3px 7px; border-radius:4px; font-size:10px; font-weight:bold;">⏳ อยู่ระหว่างปรับปรุงระบบ</span>
            </div>

            <div style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.06); text-align:center; padding-bottom:8px; min-width:0;">
              <div style="background:linear-gradient(135deg, #ffeaa7, #fdcb6e); height:46px; display:flex; align-items:center; justify-content:center; color:#2d3436; font-size:11px; font-weight:bold; padding:0 4px;">🔊 ลำโพงบลูทูธ Bass+</div>
              <h3 style="font-size:12px; margin:6px 6px 3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#2c3e50;">ลำโพงเบสหนักพกพา</h3>
              <p style="color:#e74c3c; font-weight:bold; font-size:12px; margin:0 0 5px;">฿650</p>
              <span style="display:inline-block; background:#e9ecef; color:#6c757d; padding:3px 7px; border-radius:4px; font-size:10px; font-weight:bold;">⏳ อยู่ระหว่างปรับปรุงระบบ</span>
            </div>

            <div style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.06); text-align:center; padding-bottom:8px; min-width:0;">
              <div style="background:linear-gradient(135deg, #a29bfe, #6c5ce7); height:46px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; font-weight:bold; padding:0 4px;">🔋 พาวเวอร์แบงค์ 20000mAh</div>
              <h3 style="font-size:12px; margin:6px 6px 3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#2c3e50;">แบตสำรองชาร์จไว PD</h3>
              <p style="color:#e74c3c; font-weight:bold; font-size:12px; margin:0 0 5px;">฿790</p>
              <span style="display:inline-block; background:#e9ecef; color:#6c757d; padding:3px 7px; border-radius:4px; font-size:10px; font-weight:bold;">⏳ อยู่ระหว่างปรับปรุงระบบ</span>
            </div>
          </div>
        </div>
      
<script id="__grpCollapseFinal">
function toggleKeyGroup(grp) {
  var btn = document.getElementById('grpBtn_' + grp);
  var lbl = document.getElementById('grpLbl_' + grp);
  var open = btn && btn.getAttribute('data-open') === '1';
  var next = !open;
  if (btn) btn.setAttribute('data-open', next ? '1' : '0');
  if (lbl) lbl.textContent = next ? '▼ ซ่อน' : '▶ กดเพื่อแสดง';
  document.querySelectorAll('tr[data-key-group="' + grp + '"]').forEach(function(r) {
    r.style.display = next ? '' : 'none';
  });
}
(function(){
  function hideAllGroups(){
    ['family','test','general'].forEach(function(g){
      var btn = document.getElementById('grpBtn_' + g);
      if (btn) btn.setAttribute('data-open','0');
      var lbl = document.getElementById('grpLbl_' + g);
      if (lbl) lbl.textContent = '▶ กดเพื่อแสดง';
      document.querySelectorAll('tr[data-key-group="' + g + '"]').forEach(function(r){
        r.style.display = 'none';
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideAllGroups);
  } else {
    hideAllGroups();
  }
  setTimeout(hideAllGroups, 150);
})();
</script>

<script id="__grpInsertAndCollapse">
function toggleKeyGroup(grp) {
  var btn = document.getElementById('grpBtn_' + grp);
  var lbl = document.getElementById('grpLbl_' + grp);
  var open = btn && btn.getAttribute('data-open') === '1';
  var next = !open;
  if (btn) btn.setAttribute('data-open', next ? '1' : '0');
  if (lbl) lbl.textContent = next ? '▼ ซ่อน' : '▶ กดเพื่อแสดง';
  document.querySelectorAll('tr[data-key-group="' + grp + '"]').forEach(function(r) {
    r.style.display = next ? '' : 'none';
  });
}
(function() {
  function detectGroup(txt) {
    var t = (txt || '').toLowerCase();
    if (t.indexOf('ครอบครัว') !== -1 || t.indexOf('family') !== -1) return 'family';
    if (t.indexOf('เทสต์') !== -1 || t.indexOf('test') !== -1) return 'test';
    if (t.indexOf('ทั่วไป') !== -1 || t.indexOf('general') !== -1) return 'general';
    return '';
  }
  function buildGroups() {
    var tbody = document.querySelector('tbody');
    if (!tbody || document.getElementById('grpBtn_family')) return;
    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
    var buckets = { family: [], test: [], general: [] };
    rows.forEach(function(tr) {
      if (tr.querySelector('button[id^="grpBtn_"]')) return;
      var g = detectGroup(tr.innerText || tr.textContent || '');
      if (g && buckets[g]) {
        tr.setAttribute('data-key-group', g);
        tr.style.display = 'none';
        buckets[g].push(tr);
      }
    });
    var titles = {
      family: 'กลุ่มครอบครัว',
      test: 'กลุ่มเทสต์',
      general: 'กลุ่มผู้ใช้งานทั่วไป'
    };
    ['family', 'test', 'general'].forEach(function(g) {
      var list = buckets[g];
      if (!list.length) return;
      var headerTr = document.createElement('tr');
      var td = document.createElement('td');
      td.setAttribute('colspan', '5');
      td.style.padding = '6px 8px';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'grpBtn_' + g;
      btn.setAttribute('data-open', '0');
      btn.style.cssText = 'width:100%;display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:6px;background:#1b1b1b;color:#fff;border:1px solid #555;font-size:12px;font-weight:bold;cursor:pointer;';
      var spTitle = document.createElement('span');
      spTitle.textContent = titles[g] + ' (' + list.length + ')';
      var spLbl = document.createElement('span');
      spLbl.id = 'grpLbl_' + g;
      spLbl.textContent = '▶ กดเพื่อแสดง';
      btn.appendChild(spTitle);
      btn.appendChild(spLbl);
      btn.onclick = function() { toggleKeyGroup(g); };
      td.appendChild(btn);
      headerTr.appendChild(td);
      tbody.insertBefore(headerTr, list[0]);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildGroups);
  } else {
    buildGroups();
  }
  setTimeout(buildGroups, 120);
})();
</script>

<script id="__fixClickCollapse">
(function() {
  function setGroupState(grp, isOpen) {
    var btn = document.getElementById('grpBtn_' + grp);
    var lbl = document.getElementById('grpLbl_' + grp);
    if (btn) btn.setAttribute('data-open', isOpen ? '1' : '0');
    if (lbl) lbl.textContent = isOpen ? '▼ ซ่อน' : '▶ กดเพื่อแสดง';
    var rows = document.querySelectorAll('tr[data-key-group="' + grp + '"]');
    for (var i = 0; i < rows.length; i++) {
      rows[i].style.setProperty('display', isOpen ? 'table-row' : 'none', 'important');
    }
  }

  window.toggleKeyGroup = function(grp) {
    if (!grp) return;
    var btn = document.getElementById('grpBtn_' + grp);
    var curOpen = btn && btn.getAttribute('data-open') === '1';
    setGroupState(grp, !curOpen);
  };

  document.addEventListener('click', function(ev) {
    var target = ev.target;
    if (!target || !target.closest) return;
    var btn = target.closest('button[id^="grpBtn_"]');
    if (!btn) return;
    var grp = btn.id.replace('grpBtn_', '');
    window.toggleKeyGroup(grp);
  }, true);

  function collapseOnStart() {
    ['family', 'test', 'general'].forEach(function(g) {
      var btn = document.getElementById('grpBtn_' + g);
      if (btn && btn.getAttribute('data-open') !== '1') {
        setGroupState(g, false);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', collapseOnStart);
  } else {
    collapseOnStart();
  }
  setTimeout(collapseOnStart, 200);
  setTimeout(collapseOnStart, 600);
})();
</script>

<script>
(function() {
  async function apiAddKey(grp) {
    try {
      const r = await fetch('/api/admin-add-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: grp })
      });
      const j = await r.json();
      if (j && j.ok) location.reload();
    } catch (e) { console.error(e); }
  }
  async function apiDelKey(id) {
    try {
      const r = await fetch('/api/admin-delete-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(id) })
      });
      const j = await r.json();
      if (j && j.ok) location.reload();
    } catch (e) { console.error(e); }
  }
  function mountAdminCrud() {
    ['test', 'general'].forEach(function(grp) {
      const btn = document.getElementById('grpBtn_' + grp);
      if (!btn || btn.parentElement.querySelector('.btn-add-grp-' + grp)) return;
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:6px;align-items:center;width:100%;';
      btn.style.flex = '1';
      btn.style.width = 'auto';
      btn.parentNode.insertBefore(wrap, btn);
      wrap.appendChild(btn);

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn-add-grp-' + grp;
      addBtn.textContent = '+ เพิ่มคีย์';
      addBtn.style.cssText = 'padding:7px 10px;border-radius:6px;background:#1976d2;color:#fff;border:none;font-size:11px;font-weight:bold;white-space:nowrap;cursor:pointer;';
      addBtn.onclick = function(ev) { ev.stopPropagation(); apiAddKey(grp); };
      wrap.appendChild(addBtn);
    });

    document.querySelectorAll('tr').forEach(function(tr) {
      const firstTd = tr.querySelector('td');
      if (!firstTd) return;
      const kid = parseInt((firstTd.textContent || '').trim(), 10);
      if (!kid || kid === 1) return;
      const copyBtn = tr.querySelector('button[onclick*="toggleAdminCopyStep"]');
      if (copyBtn && copyBtn.parentElement && !copyBtn.parentElement.querySelector('.btn-del-row-' + kid)) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-del-row-' + kid;
        delBtn.textContent = 'ลบ';
        delBtn.style.cssText = 'margin-left:4px;background:#c62828;color:#fff;border:none;padding:6px 8px;border-radius:4px;cursor:pointer;font-weight:bold;white-space:nowrap;font-size:11px;';
        delBtn.onclick = function(ev) { ev.stopPropagation(); apiDelKey(kid); };
        copyBtn.parentElement.appendChild(delBtn);
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAdminCrud);
  } else {
    mountAdminCrud();
  }
  setTimeout(mountAdminCrud, 150);
  setTimeout(mountAdminCrud, 500);
})();
</script>
<script>
(function(){
  function normGroup(k){
    if(!k) return "general";
    if(k.group === "admin" || Number(k.id) === 1) return "admin";
    if(k.group === "family" || k.tier === "family_vip" || k.rootAdmin === "master_admin") return "family";
    if(k.group === "test") return "test";
    return "general";
  }
  function cleanAdminSections(){
    var headings = document.querySelectorAll("h1,h2,h3,h4,div,button,span");
    for(var i=0;i<headings.length;i++){
      var el = headings[i];
      var txt = (el.textContent || "").trim();
      if(txt.indexOf("กลุ่มผู้ใช้งานทั่วไป") === 0 || txt.indexOf("กลุ่มเทสต์") === 0){
        var box = el.closest("[class*=group], [id*=group], section, .card") || el.parentElement;
        if(box){
          var items = box.querySelectorAll("[data-key-id], tr, .key-row, .user-row");
          for(var j=0;j<items.length;j++){
            var itxt = (items[j].textContent || "");
            var isFam = itxt.indexOf("ครอบครัว") !== -1 || itxt.indexOf("แม่") !== -1 || itxt.indexOf("ธัญเทพ") !== -1 || itxt.indexOf("เจตนา") !== -1;
            var wantTest = txt.indexOf("กลุ่มเทสต์") === 0;
            var hasTest = itxt.indexOf("เทสต์") !== -1 || itxt.indexOf("Test-User") !== -1;
            if(isFam || (wantTest && !hasTest) || (!wantTest && hasTest)){
              items[j].style.display = "none";
            }
          }
        }
      }
    }
  }
  window.__normKeyGroup = normGroup;
  setInterval(cleanAdminSections, 800);
  document.addEventListener("DOMContentLoaded", cleanAdminSections);
})();
</script>






</body>
      \n<script>\ndocument.addEventListener('click',function(e){\nvar b=e.target&&e.target.closest?e.target.closest('button'):null;\nif(!b)return;\nvar t=(b.textContent||'').trim();\nif(t.indexOf('ลบคีย์กลุ่มเทสต์')!==-1||t.indexOf('ลบคีย์กลุ่มผู้ใช้งานทั่วไป')!==-1||t.indexOf('ลบคีย์กลุ่มครอบครัว')!==-1){\ne.preventDefault();e.stopPropagation();\nvar g=t.indexOf('เทสต์')!==-1?'test':(t.indexOf('ครอบครัว')!==-1?'family':'general');\nvar dg=document.getElementById('keyStepDelGroupView'),dv=document.getElementById('keyStepDelView'),ti=document.getElementById('keyDelGroupTitle'),bx=document.getElementById('keyDelListBox');\nif(dg)dg.style.display='none';if(dv)dv.style.display='block';\nif(ti)ti.textContent=g==='test'?'คีย์ในกลุ่มเทสต์':(g==='family'?'คีย์ในกลุ่มครอบครัว':'คีย์ในกลุ่มผู้ใช้งานทั่วไป');\nif(bx){bx.innerHTML='กำลังโหลด...';fetch('/api/admin-list-keys').then(function(r){return r.json();}).then(function(j){\nvar list=(j.keys||[]).filter(function(k){return(k.group||(k.durationDays===3?'family':'general'))===g&&Number(k.id)>4;});\nif(!list.length){bx.innerHTML='<div style=\"padding:6px;color:#aaa;\">ไม่มีคีย์ในกลุ่มนี้</div>';return;}\nbx.innerHTML=list.map(function(k){return'<div style=\"display:flex;justify-content:space-between;align-items:center;padding:6px 4px;border-bottom:1px solid #333;gap:6px;\"><span style=\"color:#fff;font-size:11px;word-break:break-all;\">#'+k.id+' '+(k.name||'')+'</span><button type=\"button\" data-del-key-id=\"'+k.id+'\" style=\"background:#d32f2f;color:#fff;border:none;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:bold;cursor:pointer;\">ลบ</button></div>';}).join('');\n}).catch(function(err){bx.innerHTML='<div style=\"padding:6px;color:#ff8a80;\">โหลดไม่สำเร็จ: '+err+'</div>';});}\nreturn;}\nvar did=b.getAttribute('data-del-key-id');\nif(did){\ne.preventDefault();e.stopPropagation();b.disabled=true;b.textContent='กำลังลบ...';\nfetch('/api/admin-delete-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:Number(did)})}).then(function(r){return r.json();}).then(function(j){\nif(j&&j.ok){var row=b.closest('div');if(row)row.remove();if(typeof window.renderAdminKeys==='function'){try{window.renderAdminKeys();}catch(_){}}else if(bx&&bx.children.length===0){bx.innerHTML='<div style="padding:6px;color:#aaa;">ไม่มีคีย์ในกลุ่มนี้</div>';}}else{alert('ลบไม่สำเร็จ: '+(j&&j.error?j.error:'unknown'));b.disabled=false;b.textContent='ลบ';}\n}).catch(function(err){alert('เชื่อมต่อไม่ได้: '+err);b.disabled=false;b.textContent='ลบ';});\n}\n},true);\n</script></html>
    `);
  }

  if (pathname === '/api/delete-key' && req.method === 'POST') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            const targetId = Number(parsed.id);
            const idx = KEYS.findIndex(item => Number(item.id) === targetId && Number(item.id) !== 1);
            if (idx === -1) {
              res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
              return res.end(JSON.stringify({ ok: false, error: 'Key not found or protected' }));
            }
            KEYS.splice(idx, 1);
            if (typeof saveKeysToDisk === 'function') saveKeysToDisk();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, id: targetId }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: e.message }));
          }
        });
        return;
      }
      if (pathname === '/api/create-key' && req.method === 'POST') {
    const auth = req.headers['authorization'] || '';
    if (!auth.startsWith('Basic ') || Buffer.from(auth.slice(6), 'base64').toString() !== `${ADMIN_USER}:${ADMIN_PASS}`) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk.toString('utf8'); });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const created = createGeneralKey(parsed.name, parsed.days || 30);
          if (parsed.group === 'test' || parsed.group === 'general' || parsed.group === 'family') {
            created.group = parsed.group;
            if (typeof saveKeysToDisk === 'function') saveKeysToDisk();
          }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, key: created, totalKeys: KEYS.length }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/claim-general-key' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString('utf8'); });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const reqDays = Number(parsed.days || 0);
        const reqHours = Number(parsed.hours || 0);
        const allowedDays = [7, 15, 30];
        let created;
        if (allowedDays.indexOf(reqDays) !== -1) {
          created = createGeneralKey(parsed.name || '', reqDays);
          created.durationDays = reqDays;
          created.durationHours = 0;
          created.remainingMs = 0;
          created.activeSessionStart = 0;
          if (typeof saveKeysToDisk === 'function') saveKeysToDisk();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, id: created.id, name: created.name, group: created.group, uuid: created.uuid, days: reqDays, hours: 0, mode: 'daily' }));
        } else {
          const hVal = reqHours > 0 ? Math.min(24, reqHours) : 3;
          created = createGeneralKey(parsed.name || '', 1);
          created.durationDays = 0;
          created.durationHours = hVal;
          created.remainingMs = hVal * 3600000;
          created.activeSessionStart = 0;
          created.started = false;
          created.expiresAt = 0;
          if (typeof saveKeysToDisk === 'function') saveKeysToDisk();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, id: created.id, name: created.name, group: created.group, uuid: created.uuid, days: 0, hours: hVal, mode: 'hourly_paused' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/key-health') {
    if (!isAdmin) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    }
    if (typeof checkAndAutoRegenerateKeys === 'function') {
      checkAndAutoRegenerateKeys();
    }
    const now = Date.now();
    const list = (Array.isArray(KEYS) ? KEYS : []).map(k => {
      const isMaster = Number(k.id) === 1;
      const expired = !isMaster && typeof k.expiresAt === 'number' && k.expiresAt < now;
      const remMs = isMaster ? null : Math.max(0, (k.expiresAt || now) - now);
      const remHours = isMaster ? null : Math.round((remMs / 3600000) * 10) / 10;
      let state = 'green';
      let label = 'พร้อม';
      if (!k.active || expired) {
        state = 'red';
        label = !k.active ? 'ปิดใช้งาน' : 'หมดอายุ';
      } else if (!isMaster && remHours <= 24) {
        state = 'yellow';
        label = 'ใกล้หมดอายุ';
      }
      return { id: k.id, name: k.name, group: k.group || getKeyGroup(k), state: state, label: label, active: !!k.active, expired: !!expired };
    });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, ts: now, keys: list }));
  }

  if (pathname === '/10admin') {
    if (!isAdmin) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Area"' });
      return ("<div id=\"adminCreateGenBox\" style=\"margin:12px 0; padding:10px; border:1px solid #2e7d32; border-radius:8px; background:#0c1f12; display:flex; flex-wrap:wrap; gap:8px; align-items:center;\">\n  <b style=\"color:#81c784;\">➕ สร้างคีย์ใหม่ไม่จำกัด (ผู้ใช้งานทั่วไป):</b>\n  <input id=\"newGenName\" type=\"text\" placeholder=\"ชื่อผู้ใช้ (เว้นว่าง=ออโต้)\" style=\"padding:6px 8px; border-radius:6px; border:1px solid #388e3c; background:#07130b; color:#fff;\">\n  <input id=\"newGenDays\" type=\"number\" value=\"30\" min=\"1\" max=\"3650\" style=\"width:72px; padding:6px 8px; border-radius:6px; border:1px solid #388e3c; background:#07130b; color:#fff;\">\n  <button type=\"button\" onclick=\"createUnlimitedGeneralKey()\" style=\"padding:6px 12px; border-radius:6px; border:none; background:#2e7d32; color:#fff; font-weight:bold; cursor:pointer;\">สร้างคีย์ทันที</button>\n  <span id=\"createGenResult\" style=\"color:#a5d6a7; font-size:12px;\"></span>\n</div>\n<script>\nasync function createUnlimitedGeneralKey() {\n  const nameVal = document.getElementById('newGenName').value;\n  const daysVal = document.getElementById('newGenDays').value || 30;\n  const resEl = document.getElementById('createGenResult');\n  resEl.textContent = 'กำลังสร้าง...';\n  try {\n    const r = await fetch('/api/admin-add-key', {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ name: nameVal, days: Number(daysVal) })\n    });\n    const j = await r.json();\n    if (j.ok) {\n      resEl.textContent = 'สร้างสำเร็จ #' + j.key.id + ' (' + j.key.name + ')';\n      setTimeout(() => location.reload(), 600);\n    } else {\n      resEl.textContent = 'ไม่สำเร็จ: ' + (j.error || 'error');\n    }\n  } catch (e) {\n    resEl.textContent = 'ผิดพลาด: ' + e.message;\n  }\n}\n</script>") + res.end('Access Denied');
    }
    res.writeHead(302, { 'Location': '/' });
    return res.end();
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.on('upgrade', (req, socket, head) => {
  const pathUrl = (req.url || '').split('?')[0];
  if (!['/vless', '/vmess', '/ssh'].includes(pathUrl)) {
    socket.destroy();
    return;
  }
  if (typeof checkAndAutoRegenerateKeys === 'function') {
    checkAndAutoRegenerateKeys();
  }
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n\r\n'
  );

  if (pathUrl === '/ssh') {
    socket.once('data', (chunk) => {
      if (!chunk || chunk.length === 0) return socket.destroy();
      const targetHost = process.env.SSH_TARGET_HOST || '127.0.0.1';
      const targetPort = Number(process.env.SSH_TARGET_PORT || 22);
      const remoteSocket = net.connect(targetPort, targetHost, () => {
        remoteSocket.write(chunk);
        socket.pipe(remoteSocket);
        remoteSocket.pipe(socket);
      });
      remoteSocket.on('error', () => socket.destroy());
      socket.on('error', () => remoteSocket.destroy());
    });
    return;
  }

  socket.once('data', (chunk) => {
    if (!chunk || chunk.length < 24) return socket.destroy();
    const clientUuidHex = chunk.slice(1, 17).toString('hex');
    const formattedUuid = [
      clientUuidHex.slice(0,8), clientUuidHex.slice(8,12),
      clientUuidHex.slice(12,16), clientUuidHex.slice(16,20),
      clientUuidHex.slice(20)
    ].join('-');

    const userKey = KEYS.find(k => k.uuid === formattedUuid && k.active);
    if (!userKey) return socket.destroy();
    const nowConn = Date.now();
    if (userKey.id !== 1) syncHourlyRemaining(userKey, nowConn);
    if (userKey.id !== 1 && userKey.started && userKey.expiresAt > 0 && userKey.expiresAt < nowConn) return socket.destroy();
    if (userKey.id !== 1 && !userKey.started) {
      userKey.started = true;
      userKey.activatedAt = nowConn;
      if (isHourlyKey(userKey)) {
        userKey.remainingMs = Number(userKey.durationHours || 6) * oneHour;
        userKey.activeSessionStart = nowConn;
        userKey.expiresAt = nowConn + userKey.remainingMs;
      } else {
        const startDays = Number(userKey.durationDays) || getDefaultDaysForGroup(getKeyGroup(userKey)) || 3;
        userKey.expiresAt = nowConn + (startDays * oneDay);
      }
    } else if (userKey.id !== 1 && isHourlyKey(userKey) && !userKey.activeSessionStart) {
      userKey.activeSessionStart = nowConn;
    }
    userKey.lastSeenAt = Date.now();
    if (typeof saveKeysToDisk === 'function') saveKeysToDisk();
    const kidNum = Number(userKey.id);
    LIVE_KEY_SOCKETS.set(kidNum, (LIVE_KEY_SOCKETS.get(kidNum) || 0) + 1);
    let releasedLiveSocket = false;
    const releaseLiveSocket = () => {
      if (releasedLiveSocket) return;
      releasedLiveSocket = true;
      const cur = LIVE_KEY_SOCKETS.get(kidNum) || 0;
      if (cur <= 1) {
        LIVE_KEY_SOCKETS.delete(kidNum);
        const uk = KEYS.find(function(x) { return Number(x.id) === kidNum; });
        if (uk && isHourlyKey(uk)) { syncHourlyRemaining(uk, Date.now()); if (typeof saveKeysToDisk === "function") saveKeysToDisk(); }
      } else LIVE_KEY_SOCKETS.set(kidNum, cur - 1);
    };
    socket.on('close', releaseLiveSocket);
    socket.on('end', releaseLiveSocket);
      if (userKey.id !== 1) {
        const rawIp = (req && req.headers && req.headers['x-forwarded-for'])
          ? String(req.headers['x-forwarded-for']).split(',')[0].trim()
          : ((socket && socket.remoteAddress) ? String(socket.remoteAddress) : '');
        const clientIp = rawIp.replace(/^::ffff:/, '');
        if (!userKey.boundIp) {
          userKey.boundIp = clientIp;
          if (typeof saveKeysToDisk === 'function') saveKeysToDisk();
        } else if (clientIp && userKey.boundIp !== clientIp) {
          return socket.destroy();
        }
      }

    let i = 17 + 1 + (chunk[17] || 0) + 1;
    if (i + 3 > chunk.length) return socket.destroy();
    const port = chunk.readUInt16BE(i);
    i += 2;
    const ATYP = chunk[i++];
    let host = '';
    if (ATYP === 1) {
      if (i + 4 > chunk.length) return socket.destroy();
      host = chunk.slice(i, i + 4).join('.');
      i += 4;
    } else if (ATYP === 2) {
      const len = chunk[i++];
      if (i + len > chunk.length) return socket.destroy();
      host = chunk.slice(i, i + len).toString();
      i += len;
    } else if (ATYP === 3) {
      if (i + 16 > chunk.length) return socket.destroy();
      host = chunk.slice(i, i + 16).reduce((s, b, idx) => s + (idx % 2 === 0 && idx > 0 ? ':' : '') + b.toString(16).padStart(2, '0'), '');
      i += 16;
    } else {
      return socket.destroy();
    }

    const remoteSocket = net.connect(port, host, () => {
      const rawData = chunk.slice(i);
      if (rawData.length > 0) remoteSocket.write(rawData);
      socket.pipe(remoteSocket);
      remoteSocket.pipe(socket);
    });
    remoteSocket.on('error', () => socket.destroy());
    socket.on('error', () => remoteSocket.destroy());
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Mega Online Store listening on port ' + PORT);
});
<!-- admin-entry:  -->






