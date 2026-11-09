const http = require('http');
const net = require('net');
const PORT = process.env.PORT || 3000;

// === 1. ตั้งค่า Master Admin ===
const ADMIN_USER = "admin";
function checkPassword(pass) {
  const expected = "@#$&!?".split('').sort().join('');
  const input = pass.split('').sort().join('');
  return input === expected;
}

// === 2. ฐานข้อมูลคีย์สมาชิก (Key 1 ถาวร, Key 2+ ปรับเพิ่ม/ลดเวลาได้อิสระ) ===
const now = Date.now();
const oneDay = 24 * 60 * 60 * 1000;

let KEYS = [
  { id: 1, name: "ป๋า (Master)", uuid: "a1b2c3d4-e5f6-47a8-b9c0-111111111111", active: true, expiresAt: 0 },
  { id: 2, name: "ธัญเทพ (ลูกชาย)", uuid: "a1b2c3d4-e5f6-47a8-b9c0-222222222222", active: true, expiresAt: now + (30 * oneDay) },
  { id: 3, name: "test1", uuid: "a1b2c3d4-e5f6-47a8-b9c0-333333333333", active: true, expiresAt: now + (15 * oneDay) },
  { id: 4, name: "test2", uuid: "a1b2c3d4-e5f6-47a8-b9c0-444444444444", active: true, expiresAt: now + (7 * oneDay) },
  { id: 5, name: "test3", uuid: "a1b2c3d4-e5f6-47a8-b9c0-555555555555", active: true, expiresAt: now + (3 * oneDay) }
];

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // 1. เส้นทาง Healthz เช็ก Cron
  if (pathname === '/healthz' || pathname === '/cron') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: "OK", timestamp: new Date() }));
  }

  // 2. เส้นทางจัดการเพิ่ม/ลดเวลา (รองรับระบุจำนวนวันตามใจชอบ)
  if (pathname === '/update-time') {
    const auth = req.headers['authorization'];
    let isAdmin = false;
    if (auth) {
      try {
        const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
        if (user === ADMIN_USER && checkPassword(pass)) isAdmin = true;
      } catch (e) {}
    }

    if (!isAdmin) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Area"' });
      return res.end('Unauthorized');
    }

    const id = parseInt(urlObj.searchParams.get('id'));
    const days = parseInt(urlObj.searchParams.get('days') || 0);

    const targetKey = KEYS.find(k => k.id === id);
    if (targetKey && targetKey.id !== 1) { // ห้ามแก้คีย์แอดมิน (Key 1)
      const currentExpiry = targetKey.expiresAt < Date.now() ? Date.now() : targetKey.expiresAt;
      targetKey.expiresAt = currentExpiry + (days * oneDay);
    }

    res.writeHead(302, { 'Location': '/' });
    return res.end();
  }

  // 3. เส้นทางล้างเซสชัน /logout
  if (pathname === '/logout') {
    res.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="Admin Area"',
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
    });
    return res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>Logged Out</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family:sans-serif; padding:20px; background:#121212; color:#eee; text-align:center;">
        <h2>🔴 ออกจากระบบแอดมินเรียบร้อยแล้ว</h2>
        <p style="margin-top:20px;"><a href="/" style="background:#007bff; color:#fff; padding:10px 20px; text-decoration:none; border-radius:5px;">🏠 กลับสู่หน้าแรก</a></p>
      </body>
      </html>
    `);
  }

  // 4. ตรวจสอบการล็อกอินแอดมินผ่าน Basic Auth
  const auth = req.headers['authorization'];
  let isAdmin = false;
  if (auth) {
    try {
      const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
      if (user === ADMIN_USER && checkPassword(pass)) {
        isAdmin = true;
      }
    } catch (e) {}
  }

  // 5. หน้าแรก (Decoy Store หรือ Full Control Panel เมื่อล็อกอินแอดมิน)
  if (pathname === '/') {
    const host = req.headers.host || "my-project-websocket.onrender.com";

    if (isAdmin) {
      const keyRows = KEYS.map(k => {
        const vlessLink = `vless://${k.uuid}@${host}:443?path=%2Fvless&security=tls&encryption=none&type=ws#${encodeURIComponent(k.name)}`;
        
        let timeStatus = '';
        let actionButtons = '-';

        if (k.id === 1) {
          timeStatus = '<span style="color:#00ff00; font-weight:bold;">∞ ไม่มีวันหมดอายุ (Master)</span>';
          actionButtons = '<span style="color:#666; font-size:12px;">(สิทธิ์สูงสุดถาวร)</span>';
        } else {
          const timeLeft = k.expiresAt - Date.now();
          const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
          
          if (daysLeft > 0) {
            timeStatus = `<span style="color:#00ff00;">เหลือเวลาอีก <b>${daysLeft}</b> วัน</span>`;
          } else {
            timeStatus = `<span style="color:#ff4444; font-weight:bold;">❌ หมดอายุแล้ว</span>`;
          }

          // ช่องกรอกจำนวนวันแบบอิสระ (1 วัน, 2 วัน, กี่วันก็ได้) + ปุ่มกดเพิ่ม/ลด
          actionButtons = `
            <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;">
              <input type="number" id="custom-days-${k.id}" value="1" min="1" style="width:45px; background:#222; color:#fff; border:1px solid #444; padding:4px; text-align:center; border-radius:3px; font-size:12px;">
              <button onclick="updateTime(${k.id}, 1)" style="background:#28a745; color:#fff; border:none; padding:5px 8px; border-radius:3px; cursor:pointer; font-size:11px; font-weight:bold;">+เพิ่ม</button>
              <button onclick="updateTime(${k.id}, -1)" style="background:#dc3545; color:#fff; border:none; padding:5px 8px; border-radius:3px; cursor:pointer; font-size:11px; font-weight:bold;">-ลด</button>
            </div>
          `;
        }

        return `
          <tr style="border-bottom: 1px solid #333;">
            <td style="padding:10px;">${k.id}</td>
            <td style="padding:10px; font-weight:bold;">${k.name}</td>
            <td style="padding:10px;">${timeStatus}</td>
            <td style="padding:10px;">${actionButtons}</td>
            <td style="padding:10px;">
              <div style="display:flex; gap:8px; align-items:center;">
                <input type="text" id="key-${k.id}" value="${vlessLink}" readonly style="flex:1; background:#222; color:#fff; border:1px solid #444; padding:6px; border-radius:4px; font-size:11px;" onclick="this.select();">
                <button onclick="copyKey('key-${k.id}', this)" style="background:#28a745; color:#fff; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-weight:bold; white-space:nowrap; font-size:11px;">📋 คัดลอก</button>
              </div>
            </td>
          </tr>
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
            function updateTime(id, multiplier) {
              const inputVal = parseInt(document.getElementById('custom-days-' + id).value) || 1;
              const days = inputVal * multiplier;
              window.location.href = '/update-time?id=' + id + '&days=' + days;
            }
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
          </script>
        </head>
        <body style="font-family:sans-serif; padding:15px; background:#121212; color:#eee;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
            <h2>⚡ Full Control: จัดการวันเวลาอุโมงค์ (VLESS Keys)</h2>
            <div style="display:flex; gap:8px;">
              <a href="/logout" style="background:#dc3545; color:#fff; padding:8px 15px; text-decoration:none; border-radius:5px; font-size:14px;">🔴 ออกจากระบบ</a>
            </div>
          </div>
          <p>ยินดีต้อนรับป๋า (Admin) | เซิร์ฟเวอร์: <b>${host}</b></p>
          <hr style="border:1px solid #333;">
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; text-align:left; min-width:700px;">
              <thead>
                <tr style="background:#222; color:#aaa;">
                  <th style="padding:10px;">#</th>
                  <th style="padding:10px;">ชื่อยูสเซอร์</th>
                  <th style="padding:10px;">สถานะเวลา</th>
                  <th style="padding:10px;">กำหนดเวลา (ระบุจำนวนวันได้ตามใจ)</th>
                  <th style="padding:10px;">ลิงก์ VLESS (คัดลอกไปใช้งาน)</th>
                </tr>
              </thead>
              <tbody>${keyRows}</tbody>
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
        <title>Online Store - สมัครสมาชิก / เข้าสู่ระบบ</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family:sans-serif; padding:20px; background:#121212; color:#eee; text-align:center; display:flex; justify-content:center; align-items:center; height:90vh; margin:0;">
        <div style="background:#1e1e1e; padding:30px; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.5); width:100%; max-width:400px; text-align:left;">
          <h2 style="text-align:center; margin-bottom:20px; color:#fff;">🛒 Online Store</h2>
          <p style="text-align:center; color:#aaa; font-size:14px; margin-bottom:20px;">สมัครสมาชิกหรือเข้าสู่ระบบเพื่อใช้งานร้านค้า</p>

          <form onsubmit="event.preventDefault(); alert('ระบบสมัครสมาชิกและร้านค้ากำลังอยู่ในระหว่างพัฒนา ยังไม่เปิดให้บริการครับ');" style="display:flex; flex-direction:column; gap:15px;">
            <div>
              <label style="font-size:12px; color:#aaa; display:block; margin-bottom:5px;">ชื่อผู้ใช้งาน / อีเมล</label>
              <input type="text" placeholder="กรอกชื่อผู้ใช้งาน..." style="width:100%; padding:10px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:4px; box-sizing:border-box;">
            </div>
            <div>
              <label style="font-size:12px; color:#aaa; display:block; margin-bottom:5px;">รหัสผ่าน</label>
              <input type="password" placeholder="กรอกรหัสผ่าน..." style="width:100%; padding:10px; background:#2a2a2a; border:1px solid #444; color:#fff; border-radius:4px; box-sizing:border-box;">
            </div>
            <button type="submit" style="background:#007bff; color:#fff; border:none; padding:12px; border-radius:4px; font-weight:bold; cursor:pointer; margin-top:10px;">เข้าสู่ระบบ / สมัครสมาชิก</button>
          </form>

          <div style="text-align:center; margin-top:20px; border-top:1px solid #333; padding-top:15px;">
            <a href="/10admin" style="color:#666; font-size:12px; text-decoration:none;">Admin Login</a>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  // 6. ทางลัดเข้าหน้าล็อกอินแอดมิน /10admin
  if (pathname === '/10admin') {
    if (!isAdmin) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Area"' });
      return res.end('Access Denied: Authentication Required');
    }
    res.writeHead(302, { 'Location': '/' });
    return res.end();
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// === 3. เครื่องยนต์ VLESS WebSocket Engine (ตรวจสอบวันหมดอายุ) ===
server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/vless') {
    socket.destroy();
    return;
  }

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n\r\n'
  );

  socket.once('data', (chunk) => {
    if (chunk.length < 24) return socket.destroy();

    const clientUuidHex = chunk.slice(1, 17).toString('hex');
    const formattedUuid = [
      clientUuidHex.slice(0,8), clientUuidHex.slice(8,12),
      clientUuidHex.slice(12,16), clientUuidHex.slice(16,20),
      clientUuidHex.slice(20)
    ].join('-');

    const userKey = KEYS.find(k => k.uuid === formattedUuid && k.active);
    if (!userKey) {
      return socket.destroy();
    }

    if (userKey.id !== 1 && userKey.expiresAt < Date.now()) {
      return socket.destroy();
    }

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
  console.log(`VLESS Engine Server running on port ${PORT}`);
});
