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

let KEYS = [
  { id: 1, name: "ป๋า (Master)", group: "admin", uuid: "a1b2c3d4-e5f6-47a8-b9c0-111111111111", active: true, expiresAt: 0 },
  { id: 2, name: "ครอบครัว 1", group: "family", uuid: crypto.randomUUID(), active: true, expiresAt: now + (30 * oneDay) },
  { id: 3, name: "ครอบครัว 2", group: "family", uuid: crypto.randomUUID(), active: true, expiresAt: now + (15 * oneDay) },
  { id: 4, name: "ครอบครัว 3", group: "family", uuid: crypto.randomUUID(), active: true, expiresAt: now + (7 * oneDay) },
  { id: 5, name: "Test 1", group: "test", uuid: crypto.randomUUID(), active: true, expiresAt: now + (3 * oneDay) },
  { id: 6, name: "ผู้ใช้งานทั่วไป 1", group: "general", uuid: crypto.randomUUID(), active: true, expiresAt: now + (30 * oneDay) }
];

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
    admin:   { label: '👑 แอดมิน',         bg: 'rgba(255,193,7,0.18)',  color: '#ffd54f', border: 'rgba(255,193,7,0.45)' },
    family:  { label: '🏠 ครอบครัว',       bg: 'rgba(0,229,255,0.15)',  color: '#4dd0e1', border: 'rgba(0,229,255,0.40)' },
    test:    { label: '🧪 เทสต์',          bg: 'rgba(255,128,171,0.15)',color: '#ff80ab', border: 'rgba(255,128,171,0.40)' },
    general: { label: '👤 ผู้ใช้งานทั่วไป', bg: 'rgba(76,175,80,0.18)',  color: '#81c784', border: 'rgba(76,175,80,0.45)' }
  };
  const m = map[grp] || map.general;
  return `<div style="margin-top:3px;"><span style="display:inline-block; padding:1px 5px; border-radius:4px; font-size:10px; font-weight:bold; background:${m.bg}; color:${m.color}; border:1px solid ${m.border};">${m.label}</span></div>`;
}

function checkAndAutoRegenerateKeys() {
  const currentTime = Date.now();
  KEYS.forEach(k => {
    const grp = getKeyGroup(k);
    if (k.id !== 1 && grp !== 'general' && k.expiresAt > 0 && k.expiresAt <= currentTime) {
      k.uuid = crypto.randomUUID();
      k.expiresAt = currentTime + (30 * oneDay);
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
      KEYS = raw.keys.map(k => ({
        ...k,
        group: getKeyGroup(k),
        uuid: k.uuid || crypto.randomUUID(),
        active: k.active !== false,
        expiresAt: Number(k.expiresAt || 0)
      }));
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
    port: "443",
    id: adminUuid,
    aid: "0",
    scy: "auto",
    net: "ws",
    type: "none",
    host: safeHost,
    path: "/vmess",
    tls: "tls"
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

  if (pathname === '/admin-action') {
    if (!isAdmin) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Area"' });
      return res.end('Unauthorized');
    }
    const action = urlObj.searchParams.get('action');
    const adminKey = KEYS.find(k => k.id === 1);
    if (adminKey && action === 'regenerate') {
      adminKey.uuid = crypto.randomUUID();
    }
    res.writeHead(302, { 'Location': '/' });
    return res.end();
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
      const currentExpiry = targetKey.expiresAt < Date.now() ? Date.now() : targetKey.expiresAt;
      targetKey.expiresAt = currentExpiry + (days * oneDay);
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
</body>
      </html>
    `);
  }

  if (pathname === '/') {
    const host = req.headers.host || "my-project-websocket.onrender.com";

    if (isAdmin) {
      const __gCnt = { family:0, test:0, general:0 }; KEYS.forEach(x => { const g = getKeyGroup(x); if (__gCnt[g] !== undefined) __gCnt[g]++; }); const __gSeen = {};
const keyRows = KEYS.map(k => {
      const famNames = { 2: 'ครอบครัว 1', 3: 'ครอบครัว 2', 4: 'ครอบครัว 3' };
      const displayName = famNames[Number(k.id)] || k.name;

        const vlessLink = `vless://${k.uuid}@${host}:443?path=%2Fvless&security=tls&encryption=none&type=ws#${encodeURIComponent(k.name)}`;
        
        let timeStatus = '';
        let actionButtons = '-';

        if (k.id === 1) {
          const bundle = buildAdminAllInOne(k.uuid, k.name, host);
          timeStatus = '<span style="color:#00ff00; font-weight:bold;">แอดมิน</span>';
          actionButtons = `
            <div style="position:relative; display:inline-block;">
              <button onclick="toggleMenu()" style="background:#ffc107; color:#000; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:12px;">⚙️ เมนูป้องกัน</button>
              <div id="admin-dropdown" style="display:none; position:absolute; right:0; background:#222; border:1px solid #444; border-radius:4px; box-shadow:0 4px 10px rgba(0,0,0,0.5); z-index:10; min-width:160px; margin-top:5px;">
                <a href="/admin-action?action=refresh" style="display:block; padding:10px; color:#fff; text-decoration:none; font-size:12px; border-bottom:1px solid #333;">🔄 รีเฟรช</a>
                <a href="/admin-action?action=regenerate" onclick="return confirm('⚠️ ยืนยันการสร้างคีย์ใหม่?');" style="display:block; padding:10px; color:#ff4444; text-decoration:none; font-size:12px; font-weight:bold;">✨ สร้างคีย์ใหม่</a>
              </div>
            </div>
          `;
        } else {
          const timeLeft = k.expiresAt - Date.now();
          const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
          
          const isGeneral = getKeyGroup(k) === 'general';
          if (daysLeft > 0) {
            timeStatus = `<span style="color:#00ff00;"><b>${daysLeft}</b> วัน (${isGeneral ? 'ทั่วไป' : 'อัตโนมัติ'})</span>`;
          } else {
            timeStatus = isGeneral
              ? `<span style="color:#ff4444; font-weight:bold;">⛔ หมดอายุ</span>`
              : `<span style="color:#ff4444; font-weight:bold;">🔄 กำลังสร้างใหม่...</span>`;
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
          ${(() => { const __g = getKeyGroup(k); if (!['family','test','general'].includes(__g) || __gSeen[__g]) return ''; __gSeen[__g] = true; const __t = __g==='family'?'กลุ่มครอบครัว':(__g==='test'?'กลุ่มเทสต์':'กลุ่มผู้ใช้งานทั่วไป'); return '<tr><td colspan="5" style="padding:6px 8px;"><button type="button" id="grpBtn_' + __g + '" data-open="0" onclick="toggleKeyGroup(\'' + __g + '\')" style="width:100%;display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:6px;background:#1b1b1b;color:#fff;border:1px solid #555;font-size:12px;font-weight:bold;"><span>' + __t + ' (' + __gCnt[__g] + ')</span><span id="grpLbl_' + __g + '">▶ กดเพื่อแสดง</span></button></td></tr>'; })()}${(() => { const __g = getKeyGroup(k); if (!['family','test','general'].includes(__g) || __gSeen[__g]) return ''; __gSeen[__g] = true; const __t = __g==='family'?'กลุ่มครอบครัว':(__g==='test'?'กลุ่มเทสต์':'กลุ่มผู้ใช้งานทั่วไป'); return '<tr><td colspan="5" style="padding:6px 8px;"><button type="button" id="grpBtn_' + __g + '" data-open="0" onclick="toggleKeyGroup(\'' + __g + '\')" style="width:100%;display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:6px;background:#1b1b1b;color:#fff;border:1px solid #555;font-size:12px;font-weight:bold;"><span>' + __t + ' (' + __gCnt[__g] + ')</span><span id="grpLbl_' + __g + '">▶ กดเพื่อแสดง</span></button></td></tr>'; })()}<tr data-key-group="${getKeyGroup(k)}" style="border-bottom: 1px solid #333;">
            <td style="padding:4px 1px; font-size:11px; word-break:break-word;">${k.id}</td>
            <td style="padding:4px 1px; font-size:11px; font-weight:bold; word-break:break-word;"><span id="user-status-${k.id}" data-key-id="${k.id}" style="display:inline-block; padding:2px 6px; border-radius:4px; font-weight:bold; background:rgba(255,193,7,0.16); color:#ffc107; border:1px solid rgba(255,193,7,0.45);">⏳ ${displayName}</span>${getGroupBadgeHtml(k)}</td>
            <td style="padding:4px 1px; font-size:11px; word-break:break-word;">${timeStatus}</td>
            <td style="padding:4px 1px; font-size:11px; word-break:break-word;">${actionButtons}</td>
            <td style="padding:4px 1px; font-size:11px; word-break:break-word;">
              <div style="display:flex; gap:8px; align-items:center;">
<div style="display:flex; gap:6px; align-items:center;"><input type="text" id="key-${k.id}" data-uuid="${k.uuid}" data-name="${encodeURIComponent(k.name)}" value="${vlessLink}" readonly style="flex:1; min-width:0; background:#222; color:#fff; border:1px solid #444; padding:6px; border-radius:4px; font-size:11px;" onclick="this.select();"><div style="position:relative; display:inline-block; z-index:99;"><button type="button" onclick="toggleAdminCopyStep(${k.id})" style="background:#28a745; color:#fff; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-weight:bold; white-space:nowrap; font-size:11px;">📋 คัดลอก ▾</button><div id="admin-copy-menu-${k.id}" style="display:none; position:fixed; right:12px; background:#1e1e1e; border:1px solid #666; border-radius:6px; box-shadow:0 6px 18px rgba(0,0,0,0.85); z-index:9999; min-width:150px;"><button type="button" onclick="copyAdminByType(${k.id},'vless',this)" style="display:block; width:100%; text-align:left; background:none; border:none; border-bottom:1px solid #333; padding:9px 12px; color:#00e5ff; font-size:11px; font-weight:bold;">คัดลอกคีย์ VLESS</button><button type="button" onclick="copyAdminByType(${k.id},'vmess',this)" style="display:block; width:100%; text-align:left; background:none; border:none; border-bottom:1px solid #333; padding:9px 12px; color:#ffc107; font-size:11px; font-weight:bold;">คัดลอกคีย์ VMess</button><button type="button" onclick="copyAdminByType(${k.id},'ssh',this)" style="display:block; width:100%; text-align:left; background:none; border:none; padding:9px 12px; color:#ff80ab; font-size:11px; font-weight:bold;">คัดลอกคีย์ SSH/WS</button></div></div></div>
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
            function toggleAdminCopyStep(id){document.querySelectorAll('[id^="admin-copy-menu-"]').forEach(function(el){if(el.id!=="admin-copy-menu-"+id)el.style.display="none";});var m=document.getElementById("admin-copy-menu-"+id);if(!m)return;if(m.style.display==="block"){m.style.display="none";return;}var btn=document.querySelector('[onclick="toggleAdminCopyStep('+id+')"]');if(btn){var r=btn.getBoundingClientRect();m.style.top=(r.bottom+4)+"px";m.style.right=Math.max(8,window.innerWidth-r.right)+"px";}m.style.display="block";}function getAdminPayloadByType(id,kind){var h=window.location.host||"my-project-websocket.onrender.com";var inp=document.getElementById("key-"+id);var u=(inp&&inp.getAttribute("data-uuid"))||"";var rawName=(inp&&inp.getAttribute("data-name"))||"";var n=rawName?decodeURIComponent(rawName):("Key-"+id);if(kind==="vmess"){var p={v:"2",ps:n+"-VMess",add:h,port:"443",id:u,aid:"0",scy:"auto",net:"ws",type:"none",host:h,path:"/vmess",tls:"tls"};var s=JSON.stringify(p);var b64=btoa(unescape(encodeURIComponent(s)));return "vmess://"+b64;}if(kind==="ssh"){return JSON.stringify({key_id:id,label:n,uuid:u,host:h,ws_port:80,tls_port:443,ssh_port:22,paths:["/vless","/vmess","/ssh"],socks_ready:true});}return "vless://"+u+"@"+h+":443?path=%2Fvless&security=tls&encryption=none&type=ws&host="+h+"#"+encodeURIComponent(n);}function copyAdminByType(id,kind,btn){var inp=document.getElementById("key-"+id);var val=getAdminPayloadByType(id,kind);if(inp)inp.value=val;var m=document.getElementById("admin-copy-menu-"+id);if(m)m.style.display="none";if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(val).catch(function(){});}else if(inp){inp.select();try{document.execCommand("copy");}catch(e){}}if(btn){var t=btn.textContent;btn.textContent="✅ คัดลอกแล้ว";setTimeout(function(){btn.textContent=t;},1200);}}
            function copyKey(id, btn) {
              const input = document.getElementById(id);
              input.select();
              input.setSelectionRange(0, 99999);
              navigator.clipboard.writeText(input.value).then(() => {
                const orig = btn.innerHTML;
                btn.innerHTML = '✓ คัดลอกแล้ว';
                btn.style.background = '#17a2b8';
                setTimeout(() => {
                  btn.innerHTML = orig;
                  btn.style.background = '#28a745';
                }, 2000);
              });
            }

            function applyUserHealthStyle(el, state, baseName, labelText) {
              if (!el) return;
              var icon = '🟢';
              var fg = '#28a745';
              var bg = 'rgba(40,167,69,0.16)';
              var bd = 'rgba(40,167,69,0.55)';
              if (state === 'yellow') {
                icon = '🟡';
                fg = '#ffc107';
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
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
            <h2>⚡ Full Control: ระบบจัดการคีย์</h2>
            <div style="display:flex; gap:8px;">
              <a href="/logout" style="background:#dc3545; color:#fff; padding:8px 15px; text-decoration:none; border-radius:5px; font-size:14px;">🔴 ออกจากระบบ</a>
            </div>
          </div>
          <p>ยินดีต้อนรับป๋า (Admin) | เซิร์ฟเวอร์: <b>${host}</b></p>
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
        </body>
        </html>
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
</body>
      </html>
    `);
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
        const created = createGeneralKey(parsed.name || '', 7);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, id: created.id, name: created.name, group: created.group, uuid: created.uuid, days: 7 }));
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
      return { id: k.id, name: k.name, group: getKeyGroup(k), state: state, label: label, active: !!k.active, expired: !!expired };
    });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, ts: now, keys: list }));
  }

  if (pathname === '/10admin') {
    if (!isAdmin) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Area"' });
      return ("<div id=\"adminCreateGenBox\" style=\"margin:12px 0; padding:10px; border:1px solid #2e7d32; border-radius:8px; background:#0c1f12; display:flex; flex-wrap:wrap; gap:8px; align-items:center;\">\n  <b style=\"color:#81c784;\">➕ สร้างคีย์ใหม่ไม่จำกัด (ผู้ใช้งานทั่วไป):</b>\n  <input id=\"newGenName\" type=\"text\" placeholder=\"ชื่อผู้ใช้ (เว้นว่าง=ออโต้)\" style=\"padding:6px 8px; border-radius:6px; border:1px solid #388e3c; background:#07130b; color:#fff;\">\n  <input id=\"newGenDays\" type=\"number\" value=\"30\" min=\"1\" max=\"3650\" style=\"width:72px; padding:6px 8px; border-radius:6px; border:1px solid #388e3c; background:#07130b; color:#fff;\">\n  <button type=\"button\" onclick=\"createUnlimitedGeneralKey()\" style=\"padding:6px 12px; border-radius:6px; border:none; background:#2e7d32; color:#fff; font-weight:bold; cursor:pointer;\">สร้างคีย์ทันที</button>\n  <span id=\"createGenResult\" style=\"color:#a5d6a7; font-size:12px;\"></span>\n</div>\n<script>\nasync function createUnlimitedGeneralKey() {\n  const nameVal = document.getElementById('newGenName').value;\n  const daysVal = document.getElementById('newGenDays').value || 30;\n  const resEl = document.getElementById('createGenResult');\n  resEl.textContent = 'กำลังสร้าง...';\n  try {\n    const r = await fetch('/api/create-key', {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ name: nameVal, days: Number(daysVal) })\n    });\n    const j = await r.json();\n    if (j.ok) {\n      resEl.textContent = 'สร้างสำเร็จ #' + j.key.id + ' (' + j.key.name + ')';\n      setTimeout(() => location.reload(), 600);\n    } else {\n      resEl.textContent = 'ไม่สำเร็จ: ' + (j.error || 'error');\n    }\n  } catch (e) {\n    resEl.textContent = 'ผิดพลาด: ' + e.message;\n  }\n}\n</script>") + res.end('Access Denied');
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
    if (userKey.id !== 1 && userKey.expiresAt < Date.now()) return socket.destroy();

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