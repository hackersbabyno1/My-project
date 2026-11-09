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

// === 2. ฐานข้อมูล 5 คีย์สมาชิก (UUIDs & Permissions) ===
const KEYS = [
  { id: 1, name: "ป๋า (Master)", uuid: "a1b2c3d4-e5f6-47a8-b9c0-111111111111", active: true },
  { id: 2, name: "ธัญเทพ (ลูกชาย)", uuid: "a1b2c3d4-e5f6-47a8-b9c0-222222222222", active: true },
  { id: 3, name: "ลูกสาว", uuid: "a1b2c3d4-e5f6-47a8-b9c0-333333333333", active: true },
  { id: 4, name: "Key 4", uuid: "a1b2c3d4-e5f6-47a8-b9c0-444444444444", active: true },
  { id: 5, name: "Key 5", uuid: "a1b2c3d4-e5f6-47a8-b9c0-555555555555", active: true }
];

const server = http.createServer((req, res) => {
  // 1. เส้นทาง Healthz เช็ก Cron
  if (req.url === '/healthz' || req.url === '/cron') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: "OK", timestamp: new Date() }));
  }

  // 2. เส้นทางล้างเซสชัน /logout (เคลียร์ Basic Auth ออกจากเบราว์เซอร์)
  if (req.url === '/logout') {
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

  // 3. ตรวจสอบการล็อกอินแอดมินผ่าน Basic Auth (ใช้สำหรับหน้าแรกเมื่อแอดมินล็อกอินเข้ามา)
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

  // 4. หน้าแรก (Decoy Store + ฟอร์มสมัครสมาชิก/ล็อกอิน)
  if (req.url === '/' || req.url.startsWith('/?')) {
    const host = req.headers.host || "my-project-websocket.onrender.com";

    // ถ้าแอดมินล็อกอินแล้ว แสดง Full Control Panel เต็มรูปแบบทันทีที่หน้าแรก
    if (isAdmin) {
      const keyRows = KEYS.map(k => {
        const vlessLink = `vless://${k.uuid}@${host}:443?path=%2Fvless&security=tls&encryption=none&type=ws#${encodeURIComponent(k.name)}`;
        return `
          <tr style="border-bottom: 1px solid #333;">
            <td style="padding:10px;">${k.id}</td>
            <td style="padding:10px; font-weight:bold;">${k.name}</td>
            <td style="padding:10px;"><span style="color:${k.active ? '#00ff00' : '#ff0000'};">${k.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span></td>
            <td style="padding:10px;">
              <div style="display:flex; gap:8px; align-items:center;">
                <input type="text" id="key-${k.id}" value="${vlessLink}" readonly style="flex:1; background:#222; color:#fff; border:1px solid #444; padding:8px; border-radius:4px; font-size:12px;" onclick="this.select();">
                <button onclick="copyKey('key-${k.id}', this)" style="background:#28a745; color:#fff; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; font-weight:bold; white-space:nowrap;">📋 คัดลอก</button>
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
              }).catch(() => {
                document.execCommand('copy');
                btn.innerHTML = '✓ คัดลอกแล้ว';
                setTimeout(() => { btn.innerHTML = '📋 คัดลอก'; }, 2000);
              });
            }
          </script>
        </head>
        <body style="font-family:sans-serif; padding:15px; background:#121212; color:#eee;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
            <h2>⚡ Full Control: แผงควบคุมแอดมินสูงสุด</h2>
            <div style="display:flex; gap:8px;">
              <a href="/logout" style="background:#dc3545; color:#fff; padding:8px 15px; text-decoration:none; border-radius:5px; font-size:14px;">🔴 ออกจากระบบ</a>
            </div>
          </div>
          <p>ยินดีต้อนรับป๋า (Admin) | เซิร์ฟเวอร์: <b>${host}</b></p>
          <hr style="border:1px solid #333;">
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; text-align:left; min-width:600px;">
              <thead>
                <tr style="background:#222; color:#aaa;">
                  <th style="padding:10px;">#</th>
                  <th style="padding:10px;">ชื่อ</th>
                  <th style="padding:10px;">สถานะ</th>
                  <th style="padding:10px;">ลิงก์ VLESS (กดปุ่มคัดลอกเพื่อนำไปวางเทสต์)</th>
                </tr>
              </thead>
              <tbody>${keyRows}</tbody>
            </table>
          </div>
        </body>
        </html>
      `);
    }

    // ถ้ายังไม่ได้ล็อกอิน แสดงหน้าร้านค้าพรางตาพร้อมฟอร์มสมัครสมาชิก/ล็อกอิน (ยังไม่เปิดใช้งานจริงสำหรับคนทั่วไป)
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

  // 5. ทางลัดเข้าหน้าล็อกอินแอดมินโดยตรง /10admin
  if (req.url === '/10admin') {
    if (!isAdmin) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Area"' });
      return res.end('Access Denied: Authentication Required');
    }
    // ถ้าล็อกอินแล้ว ให้รีไดเรกต์กลับมาหน้าแรกที่เป็น Full Control Panel ทันที
    res.writeHead(302, { 'Location': '/' });
    return res.end();
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// === 3. เครื่องยนต์ VLESS WebSocket Engine ===
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
