const http = require('http');
const net = require('net');
const crypto = require('crypto');
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
      </body>
      </html>
    `);
  }

  if (pathname === '/') {
    const host = req.headers.host || "my-project-websocket.onrender.com";

    if (isAdmin) {
      const keyRows = KEYS.map(k => {
        const vlessLink = `vless://${k.uuid}@${host}:443?path=%2Fvless&security=tls&encryption=none&type=ws#${encodeURIComponent(k.name)}`;
        
        let timeStatus = '';
        let actionButtons = '-';

        if (k.id === 1) {
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
          
          if (daysLeft > 0) {
            timeStatus = `<span style="color:#00ff00;"><b>${daysLeft}</b> วัน (อัตโนมัติ)</span>`;
          } else {
            timeStatus = `<span style="color:#ff4444; font-weight:bold;">🔄 กำลังสร้างใหม่...</span>`;
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
          <tr style="border-bottom: 1px solid #333;">
            <td style="padding:4px 1px; font-size:11px; word-break:break-word;">${k.id}</td>
            <td style="padding:4px 1px; font-size:11px; font-weight:bold; word-break:break-word;">${k.name}</td>
            <td style="padding:4px 1px; font-size:11px; word-break:break-word;">${timeStatus}</td>
            <td style="padding:4px 1px; font-size:11px; word-break:break-word;">${actionButtons}</td>
            <td style="padding:4px 1px; font-size:11px; word-break:break-word;">
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
      </body>
      </html>
    `);
  }

  if (pathname === '/10admin') {
    if (!isAdmin) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Admin Area"' });
      return res.end('Access Denied');
    }
    res.writeHead(302, { 'Location': '/' });
    return res.end();
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/vless') {
    socket.destroy();
    return;
  }
  checkAndAutoRegenerateKeys();
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
    if (!userKey) return socket.destroy();
    if (userKey.id !== 1 && userKey.expiresAt < Date.now()) return socket.destroy();

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
