const http = require('http');
const PORT = process.env.PORT || 3000;

// ตั้งค่า Username
const ADMIN_USER = "admin";

// ฟังก์ชันเช็กรหัสผ่าน (อนุญาตให้สลับตำแหน่งอักขระ @#$&!? ได้ทุกแบบ)
function checkPassword(pass) {
  const expected = "@#$&!?".split('').sort().join('');
  const input = pass.split('').sort().join('');
  return input === expected;
}

const server = http.createServer((req, res) => {
  // 1. เส้นทางยิง Cron Check
  if (req.url === '/healthz' || req.url === '/cron') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: "OK", timestamp: new Date() }));
  }

  // 2. เส้นทางหน้าจัดการสิทธิ์ /10admin (ล็อกรหัสผ่าน + สลับตำแหน่งอักขระได้)
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

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>5-Key Permission Panel</title></head>
      <body style="font-family:sans-serif; padding:20px; background:#121212; color:#fff;">
        <h2>🔑 5-Key Permission Control Panel (Master Admin)</h2>
        <p>ยินดีต้อนรับป๋า (Master Admin)</p>
        <hr>
        <ul>
          <li>1. ป๋า (Master) - <span style="color:green;">ACTIVE</span></li>
          <li>2. ธัญเทพ (ลูกชาย) - <span style="color:green;">ACTIVE</span></li>
          <li>3. ลูกสาว - <span style="color:green;">ACTIVE</span></li>
          <li>4. Key 4 - <span style="color:green;">ACTIVE</span></li>
          <li>5. Key 5 - <span style="color:green;">ACTIVE</span></li>
        </ul>
      </body>
      </html>
    `);
  }

  // 3. หน้าแรก / (Decoy Store - หน้าร้านค้าพรางตา)
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>Welcome to Online Store</h1><p>Shopping Cart is empty.</p>');
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
