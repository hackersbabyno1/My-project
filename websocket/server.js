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

  // 2. เส้นทางล้างเซสชัน /logout (ยิงเคลียร์รหัสค้างในเบราว์เซอร์)
  if (req.url === '/logout') {
    res.writeHead(401, { 
      'WWW-Authenticate': 'Basic realm="Admin Area"',
      'Content-Type': 'text/html; charset=utf-8' 
    });
    return res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>Logged Out</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family:sans-serif; padding:20px; background:#121212; color:#eee; text-align:center;">
        <h2>🔴 ออกจากระบบและล้างเซสชันเรียบร้อยแล้ว</h2>
        <p style="margin-top:20px;"><a href="/10admin" style="background:#007bff; color:#fff; padding:10px 20px; text-decoration:none; border-radius:5px;">🔑 คลิกที่นี่เพื่อเข้าสู่ระบบใหม่</a></p>
      </body>
      </html>
    `);
  }

  // 3. เส้นทางหน้าหลังบ้าน /10admin (มี Auth ล็อกรหัสสลับตำแหน่งอักขระ)
  if (req.url === '/10admin') {
    const auth = req.headers['authorization'];
    if (!auth) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Area"' });
      return res.end('Access Denied: Authentication Required');
    }

    const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
    if (user !== ADMIN_USER || !checkPassword(pass)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Area"' });
      return res.end('Access Denied: Invalid Credentials');
    }

    const host = req.headers.host || "my-project-websocket.onrender.com";
    const keyRows = KEYS.map(k => {
      const vlessLink = `vless://${k.uuid}@${host}:443?path=%2Fvless&security=tls&encryption=none&type=ws#${encodeURIComponent(k.name)}`;
      return `
        <tr style="border-bottom: 1px solid #333;">
          <td style="padding:10px;">${k.id}</td>
          <td style="padding:10px; font-weight:bold;">${k.name}</td>
          <td style="padding:10px;"><span style="color:${k.active ? '#00ff00' : '#ff0000'};">${k.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span></td>
          <td style="padding:10px;"><input type="text" value="${vlessLink}" readonly style="width:90%; background:#222; color:#fff; border:1px solid #444; padding:5px; border-radius:4px;" onclick="this.select();"></td>
        </tr>
      `;
    }).join('');

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>5-Key Permission Panel</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family:sans-serif; padding:15px; background:#121212; color:#eee;">
        <div style="display:flex; justify-style:space-between; align-items:center;">
          <h2>🔑 แผงควบคุม 5 คีย์ VLESS (Master Admin)</h2>
          <a href="/logout" style="background:#dc3545; color:#fff; padding:8px 15px; text-decoration:none; border-radius:5px; font-size:14px; margin-left:auto;">🔴 ออกจากระบบ (Clear Session)</a>
        </div>
        <p>ยินดีต้อนรับป๋า | เซิร์ฟเวอร์: <b>${host}</b></p>
        <hr style="border:1px solid #333;">
        <table style="width:100%; border-collapse:collapse; text-align:left;">
          <thead>
            <tr style="background:#222; color:#aaa;">
              <th style="padding:10px;">#</th>
              <th style="padding:10px;">ชื่อ</th>
              <th style="padding:10px;">สถานะ</th>
              <th style="padding:10px;">คีย์ VLESS (กดก๊อปปี้ไปใส่แอป)</th>
            </tr>
          </thead>
          <tbody>${keyRows}</tbody>
        </table>
      </body>
      </html>
    `);
  }

  // 4. หน้าแรก (Decoy Store - หน้าร้านค้าพรางตา)
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>Online Store</h1><p>Shopping Cart is empty.</p>');
});

// === 3. เครื่องยนต์ VLESS WebSocket Engine (จัดการท่อ Proxy) ===
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
