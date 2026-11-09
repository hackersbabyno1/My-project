const http = require('http');
const net = require('net');
const crypto = require('crypto');
const PORT = process.env.PORT || 3000;

const ADMIN_USER = "admin";
function checkPassword(pass) {
  const expected = "@#$&!?".split('').sort().join('');
  const input = pass.split('').sort().join('');
  return input === expected;
}

const now = Date.now();
const oneDay = 24 * 60 * 60 * 1000;

let KEYS = [
  { id: 1, name: "ป๋า (Master)", uuid: "a1b2c3d4-e5f6-47a8-b9c0-111111111111", active: true, expiresAt: 0 },
  { id: 2, name: "test1", uuid: crypto.randomUUID(), active: true, expiresAt: now + (30 * oneDay) },
  { id: 3, name: "test2", uuid: crypto.randomUUID(), active: true, expiresAt: now + (15 * oneDay) },
  { id: 4, name: "test3", uuid: crypto.randomUUID(), active: true, expiresAt: now + (7 * oneDay) },
  { id: 5, name: "test4", uuid: crypto.randomUUID(), active: true, expiresAt: now + (3 * oneDay) }
];

function checkAndAutoRegenerateKeys() {
  const currentTime = Date.now();
  KEYS.forEach(k => {
    if (k.id !== 1 && k.expiresAt > 0 && k.expiresAt <= currentTime) {
      k.uuid = crypto.randomUUID();
      k.expiresAt = currentTime + (30 * oneDay);
    }
  });
}

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  checkAndAutoRegenerateKeys();

  if (pathname === '/healthz' || pathname === '/cron') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: "OK", timestamp: new Date() }));
  }

  if (pathname === '/logout') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Set-Cookie': 'admin_auth=; Max-Age=0; Path=/;',
      'WWW-Authenticate': 'Basic realm="Logout Force"'
    });
    return res.end(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/?logout=success"></head><body>กำลังออกจากระบบ...</body></html>`);
  }

  const auth = req.headers['authorization'];
  let isAdmin = false;
  if (auth) {
    try {
      const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
      if (user === ADMIN_USER && checkPassword(pass)) isAdmin = true;
    } catch (e) {}
  }

  if ((req.headers['cookie'] || '').includes('admin_auth=true')) {
    isAdmin = true;
  }

  if (pathname === '/do-login') {
    const query = urlObj.searchParams;
    if (query.get('u') === ADMIN_USER && checkPassword(query.get('p'))) {
      res.writeHead(302, { 'Set-Cookie': `admin_auth=true; Path=/; HttpOnly`, 'Location': '/' });
      return res.end();
    }
    res.writeHead(302, { 'Location': '/' });
    return res.end();
  }

  if (pathname === '/admin-action') {
    if (!isAdmin) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Area"' });
      return res.end('Unauthorized');
    }
    const action = urlObj.searchParams.get('action');
    if (action === 'regenerate') {
      const adminKey = KEYS.find(k => k.id === 1);
      if (adminKey) adminKey.uuid = crypto.randomUUID();
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

  if (pathname === '/download-config') {
    if (!isAdmin) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Area"' });
      return res.end('Unauthorized');
    }
    const id = parseInt(urlObj.searchParams.get('id'));
    const targetKey = KEYS.find(k => k.id === id);
    if (!targetKey) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Key not found');
    }

    const host = req.headers.host || "my-project-websocket.onrender.com";
    const vlessLink = `vless://${targetKey.uuid}@${host}:443?path=%2Fvless&security=tls&encryption=none&type=ws#${encodeURIComponent(targetKey.name)}`;
    const base64Content = Buffer.from(vlessLink).toString('base64').match(/.{1,76}/g).join('\n');

    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${targetKey.name.replace(/[^a-zA-Z0-9]/g, '_')}_config.txt"`
    });
    return res.end(base64Content);
  }

  if (pathname === '/') {
    const host = req.headers.host || "my-project-websocket.onrender.com";

    if (isAdmin) {
      const keyCards = KEYS.map(k => {
        let timeStatus = '';
        let actionButtons = '-';

        if (k.id === 1) {
          timeStatus = '<span style="color:#00ff00; font-weight:bold;">∞ สิทธิ์สูงสุดถาวร (Master)</span>';
          actionButtons = `
            <div style="position:relative; display:inline-block;">
              <button onclick="toggleMenu(event)" style="background:#ffc107; color:#000; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;">⚙️ เมนูป้องกัน</button>
              <div id="admin-dropdown" style="display:none; position:absolute; left:0; background:#222; border:1px solid #444; border-radius:4px; box-shadow:0 4px 10px rgba(0,0,0,0.5); z-index:99; min-width:150px; margin-top:5px;">
                <a href="/admin-action?action=refresh" style="display:block; padding:10px; color:#fff; text-decoration:none; font-size:12px; border-bottom:1px solid #333;">🔄 รีเฟรช</a>
                <a href="/admin-action?action=regenerate" onclick="return confirm('⚠️ ยืนยันการสร้างคีย์ใหม่?');" style="display:block; padding:10px; color:#ff4444; text-decoration:none; font-size:12px; font-weight:bold;">✨ สร้างคีย์ใหม่</a>
              </div>
            </div>
          `;
        } else {
          const timeLeft = k.expiresAt - Date.now();
          const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
          
          if (daysLeft > 0) {
            timeStatus = `<span style="color:#00ff00;">เหลือ <b>${daysLeft}</b> วัน <span style="font-size:11px; color:#aaa;">(สร้างใหม่เมื่อหมดอายุ)</span></span>`;
          } else {
            timeStatus = `<span style="color:#ff4444; font-weight:bold;">🔄 กำลังสร้างใหม่...</span>`;
          }

          actionButtons = `
            <div style="display:flex; gap:6px; align-items:center;">
              <input type="number" id="custom-days-${k.id}" value="1" min="1" style="width:45px; background:#222; color:#fff; border:1px solid #444; padding:4px; text-align:center; border-radius:3px; font-size:12px;">
              <button onclick="updateTime(${k.id})" style="background:#28a745; color:#fff; border:none; padding:5px 10px; border-radius:3px; cursor:pointer; font-size:11px; font-weight:bold;">✓ ตกลง</button>
            </div>
          `;
        }

        return `
          <div style="background:#1a1a1a; border:1px solid #333; border-radius:8px; padding:12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div style="flex:1; padding-right:10px;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                <span style="font-weight:bold; color:#fff; font-size:13px;">#${k.id} : ${k.name}</span>
              </div>
              <div style="font-size:12px; margin-bottom:8px;">${timeStatus}</div>
              <div>${actionButtons}</div>
            </div>
            <div>
              <a href="/download-config?id=${k.id}" title="ดาวน์โหลดคอนฟิก Base64" style="background:#17a2b8; color:#fff; width:42px; height:42px; border-radius:8px; text-decoration:none; font-size:20px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 5px rgba(0,0,0,0.3);">📥</a>
            </div>
          </div>
        `;
      }).join('');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Full Control - Admin Panel</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script>
            function toggleMenu(event) {
              event.stopPropagation();
              const menu = document.getElementById('admin-dropdown');
              if (menu) {
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
              }
            }
            window.onclick = function(event) {
              const menu = document.getElementById('admin-dropdown');
              if (menu && menu.style.display === 'block') {
                menu.style.display = 'none';
              }
            }
            function updateTime(id) {
              const inputEl = document.getElementById('custom-days-' + id);
              if (!inputEl) return;
              const days = parseInt(inputEl.value) || 1;
              window.location.href = '/update-time?id=' + id + '&days=' + days;
            }
          </script>
        </head>
        <body style="font-family:sans-serif; padding:12px; background:#121212; color:#eee; margin:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <h2 style="font-size:16px; margin:0;">⚡ Full Control: ระบบจัดการคีย์</h2>
          </div>
          <p style="font-size:11px; color:#aaa; margin-top:0;">ยินดีต้อนรับป๋า (Admin) | เซิร์ฟเวอร์: <b>${host}</b></p>
          <hr style="border:1px solid #333; margin-bottom:12px;">
          
          <div>${keyCards}</div>

          <div style="margin-top:25px; padding:12px 0; border-top:1px solid #333; text-align:center;">
            <a href="/logout" onclick="return confirm('⚠️ ยืนยันการออกจากระบบ?');" style="background:#222; color:#ff4444; border:1px solid #444; padding:5px 12px; text-decoration:none; border-radius:4px; font-size:11px; font-weight:bold; display:inline-block;">🔴 ออกจากระบบ</a>
          </div>
        </body>
        </html>
      `);
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>Online Store</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family:sans-serif; margin:0; background:#f8f9fa; color:#333;">
        <div style="background:#fff; padding:15px 25px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <h2>🛍️ Mega Online Store</h2>
          <form action="/do-login" method="GET" style="display:flex; gap:8px;">
            <input type="text" name="u" placeholder="Username" required style="padding:7px; font-size:12px;">
            <input type="password" name="p" placeholder="Password" required style="padding:7px; font-size:12px;">
            <button type="submit" style="background:#2ecc71; color:#fff; border:none; padding:7px 15px; font-weight:bold;">เข้าสู่ระบบ</button>
          </form>
        </div>
        <div style="text-align:center; padding:50px;">
          <h1>🔥 สินค้าตัวอย่างจัดแสดง</h1>
          <p>เว็บไซต์อยู่ระหว่างปรับปรุงระบบ</p>
        </div>
      </body>
      </html>
    `);
  }

  res.on('error', () => {});
  res.end('Not Found');
});

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/vless') {
    socket.destroy();
    return;
  }
  checkAndAutoRegenerateKeys();
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
  socket.once('data', (chunk) => {
    if (chunk.length < 24) return socket.destroy();
    const clientUuidHex = chunk.slice(1, 17).toString('hex');
    const formattedUuid = [
      clientUuidHex.slice(0,8), clientUuidHex.slice(8,12),
      clientUuidHex.slice(12,16), clientUuidHex.slice(16,20),
      clientUuidHex.slice(20)
    ].join('-');

    const userKey = KEYS.find(k => k.uuid === formattedUuid && k.active);
    if (!userKey || (userKey.id !== 1 && userKey.expiresAt < Date.now())) return socket.destroy();

    let i = 17 + 1 + chunk[17] + 1;
    const port = chunk.readUInt16BE(i);
    i += 2;
    const ATYP = chunk[i++];
    let host = '';
    if (ATYP === 1) {
      host = chunk.slice(i, i + 4).join('.');
      i += 4;
    } else if (ATYP === 2) {
      const len = chunk[i++];
      host = chunk.slice(i, i + len).toString();
      i += len;
    } else if (ATYP === 3) {
      host = chunk.slice(i, i + 16).reduce((s, b, idx) => s + (idx % 2 === 0 && idx > 0 ? ':' : '') + b.toString(16).padStart(2, '0'), '');
      i += 16;
    }

    const remoteSocket = net.connect(port, host, () => {
      socket.write(Buffer.from([chunk[0], 0]));
      const rawData = chunk.slice(i);
      if (rawData.length > 0) remoteSocket.write(rawData);
      socket.pipe(remoteSocket);
      remoteSocket.pipe(socket);
    });

    remoteSocket.on('error', () => socket.destroy());
    socket.on('error', () => remoteSocket.destroy());
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
