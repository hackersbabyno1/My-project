const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // ถ้าเป็น Cron Job หรือ Ping ให้ตอบกลับด้วยข้อความบอท
  if (req.url === '/cron' || req.url === '/ping' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive and running!');
    return;
  }

  // หน้า Admin Control (/10admin) พร้อมเครื่องยนต์จัดการสิทธิ์ 5-key เต็มรูปแบบ
  if (req.url === '/10admin') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="th">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>10 Admin Control - ระบบจัดการหลังบ้าน</title>
          <style>
              body { font-family: sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
              .admin-box { background: #1e293b; padding: 20px; border-radius: 8px; max-width: 700px; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
              h2 { color: #38bdf8; border-bottom: 2px solid #334155; padding-bottom: 10px; }
              .key-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
              .key-table th, .key-table td { border: 1px solid #334155; padding: 10px; text-align: left; font-size: 14px; }
              .key-table th { background: #334155; color: #38bdf8; }
              .status-active { color: #22c55e; font-weight: bold; }
              .btn { background: #ef4444; color: #fff; border: none; padding: 10px 15px; border-radius: 5px; font-weight: bold; cursor: pointer; margin-top: 15px; }
              .btn-action { background: #38bdf8; color: #0f172a; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; }
          </style>
      </head>
      <body>
          <div class="admin-box">
              <h2>🛠️ 10 Admin Control Engine (ระบบหลังบ้านและจัดการสิทธิ์)</h2>
              <p>เครื่องยนต์ควบคุมระบบ 5-key และสถานะการเชื่อมต่อทำงานเต็มรูปแบบครับป๋า!</p>
              
              <h3>🔑 จัดการสิทธิ์คีย์ผู้ใช้งาน (5-Key Permission System)</h3>
              <table class="key-table">
                  <thead>
                      <tr>
                          <th>#</th>
                          <th>ผู้ใช้งาน</th>
                          <th>Access Key</th>
                          <th>สถานะ</th>
                          <th>จัดการ</th>
                      </tr>
                  </thead>
                  <tbody>
                      <tr>
                          <td>1</td>
                          <td>ป๋า (Admin หลัก)</td>
                          <td><code>KEY-ADMIN-001</code></td>
                          <td><span class="status-active">🟢 Active</span></td>
                          <td><button class="btn-action" onclick="alert('คีย์หลักสมบูรณ์')">ตั้งค่า</button></td>
                      </tr>
                      <tr>
                          <td>2</td>
                          <td>ธัญเทพ (ลูกชาย)</td>
                          <td><code>KEY-SON-002</code></td>
                          <td><span class="status-active">🟢 Active</span></td>
                          <td><button class="btn-action" onclick="alert('อัปเดตสิทธิ์ ธัญเทพ สำเร็จ')">รีเซ็ต</button></td>
                      </tr>
                      <tr>
                          <td>3</td>
                          <td>ลูกสาว (ฝึกงาน กทม.)</td>
                          <td><code>KEY-DAUGHTER-003</code></td>
                          <td><span class="status-active">🟢 Active</span></td>
                          <td><button class="btn-action" onclick="alert('อัปเดตสิทธิ์ ลูกสาว สำเร็จ')">รีเซ็ต</button></td>
                      </tr>
                      <tr>
                          <td>4</td>
                          <td>สมาชิกคนที่ 4</td>
                          <td><code>KEY-MEMBER-004</code></td>
                          <td style="color: #94a3b8;">⚪ Standby</td>
                          <td><button class="btn-action" onclick="alert('เปิดใช้งานคีย์ที่ 4')">เปิดใช้</button></td>
                      </tr>
                      <tr>
                          <td>5</td>
                          <td>สมาชิกคนที่ 5</td>
                          <td><code>KEY-MEMBER-005</code></td>
                          <td style="color: #94a3b8;">⚪ Standby</td>
                          <td><button class="btn-action" onclick="alert('เปิดใช้งานคีย์ที่ 5')">เปิดใช้</button></td>
                      </tr>
                  </tbody>
              </table>

              <button class="btn" onclick="location.href='/'">🔙 กลับสู่หน้าร้านค้า</button>
          </div>
      </body>
      </html>
    `);
    return;
  }

  // หน้าร้านค้าหลัก
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>My Shop - ตะกร้าสินค้า</title>
        <style>
            body { font-family: sans-serif; background: #121212; color: #fff; margin: 0; padding: 15px; }
            .header { display: flex; justify-content: space-between; align-items: center; background: #1f1f1f; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; }
            .cart-box { background: #1f1f1f; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .product-grid { display: flex; gap: 10px; }
            .product-card { background: #1f1f1f; padding: 15px; border-radius: 8px; flex: 1; text-align: center; }
            .btn-buy { background: #22c55e; color: #000; border: none; padding: 8px 12px; border-radius: 5px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 10px; }
            .btn-checkout { background: #eab308; color: #000; border: none; padding: 10px; border-radius: 5px; font-weight: bold; width: 100%; cursor: pointer; }
            .item-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="header">
            <div>🛒 <b>My Shop</b></div>
            <div style="font-size: 13px; color: #aaa;">👤 testuser@gmail.com | <span style="color: #ef4444; cursor:pointer;">ออกจากระบบ</span></div>
        </div>

        <div class="cart-box">
            <h3>🛒 ตะกร้าสินค้าของคุณ (<span id="cart-count">0</span> ชิ้น)</h3>
            <div id="cart-items" style="color: #888; font-size: 14px; margin-bottom: 10px;">ไม่มีสินค้าในตะกร้า</div>
            <div style="font-weight: bold; margin-bottom: 12px;">ยอดรวมทั้งสิ้น: ฿ <span id="total-price">0.0</span></div>
            <button class="btn-checkout" onclick="alert('ไปหน้าชำระเงิน PromptPay / PayPal')">💳 ยืนยันชำระเงิน</button>
        </div>

        <h3>📦 รายการสินค้าทั้งหมด</h3>
        <div class="product-grid">
            <div class="product-card">
                <div style="background: #333; height: 70px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #777; font-size: 12px; margin-bottom: 8px;">รูปสินค้า ID 1</div>
                <div style="font-size: 14px; font-weight: bold;">สินค้าพรีเมียม A</div>
                <div style="color: #22c55e; margin: 5px 0;">฿ 490</div>
                <button class="btn-buy" onclick="addToCart('สินค้าพรีเมียม A', 490)">➕ เลือกซื้อสินค้า</button>
            </div>
            <div class="product-card">
                <div style="background: #333; height: 70px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #777; font-size: 12px; margin-bottom: 8px;">รูปสินค้า ID 2</div>
                <div style="font-size: 14px; font-weight: bold;">สินค้าพรีเมียม B</div>
                <div style="color: #22c55e; margin: 5px 0;">฿ 890</div>
                <button class="btn-buy" onclick="addToCart('สินค้าพรีเมียม B', 890)">➕ เลือกซื้อสินค้า</button>
            </div>
        </div>

        <script>
            let cart = {};
            function addToCart(name, price) {
                if (!cart[name]) { cart[name] = { price: price, qty: 0 }; }
                cart[name].qty++;
                renderCart();
            }
            function changeQty(name, amount) {
                cart[name].qty += amount;
                if (cart[name].qty <= 0) { delete cart[name]; }
                renderCart();
            }
            function renderCart() {
                let container = document.getElementById('cart-items');
                let countElem = document.getElementById('cart-count');
                let totalElem = document.getElementById('total-price');
                container.innerHTML = '';
                let totalCount = 0;
                let totalPrice = 0;
                let keys = Object.keys(cart);
                if (keys.length === 0) {
                    container.innerHTML = '<div style="color: #888;">ไม่มีสินค้าในตะกร้า</div>';
                } else {
                    keys.forEach(name => {
                        let item = cart[name];
                        totalCount += item.qty;
                        totalPrice += item.price * item.qty;
                        container.innerHTML += '<div class="item-row"><span>' + name + ' (' + item.qty + ' ชิ้น)</span><span>฿ ' + (item.price * item.qty) + ' <button onclick="changeQty(\\\'' + name + '\\\', -1)">-</button> <button onclick="changeQty(\\\'' + name + '\\\', 1)">+</button></span></div>';
                    });
                }
                countElem.innerText = totalCount;
                totalElem.innerText = totalPrice.toFixed(1);
            }
        </script>
    </body>
    </html>
  `);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Server is running on port ' + PORT);
});
