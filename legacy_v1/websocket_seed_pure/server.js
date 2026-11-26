const http = require("http");
const PORT = process.env.PORT || 3000;

const HTML_PAGE = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HACKERSBABY — ระบบเชื่อมต่อส่วนตัวความเร็วสูง</title>
</head>
<body style="margin:0; font-family:sans-serif; background:#0b111a; color:#e6edf3; padding:16px;">
  <div style="max-width:680px; margin:0 auto;">
    <div style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:14px;">
      <button type="button" onclick="copyAllKeys()" style="background:#10b981; color:#06281e; border:none; padding:8px 14px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:13px;">คัดลอกคีย์ทั้งหมด</button>
      <a href="/10admin" style="background:#1f2937; color:#e5e7eb; text-decoration:none; padding:8px 14px; border-radius:6px; font-size:13px; border:1px solid #374151;">กลับหลังบ้าน</a>
    </div>

    <div style="text-align:center; margin-bottom:20px;">
      <h1 style="margin:0 0 6px; font-size:28px; letter-spacing:1px; color:#00e676;">HACKERSBABY</h1>
      <p style="margin:0; font-size:13px; color:#9ca3af;">ระบบเชื่อมต่อส่วนตัวความเร็วสูง • สมัครสมาชิกและรับคีย์ใช้งาน</p>
    </div>

    <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px; margin-bottom:20px;">
      <div id="pkg-30d" onclick="selectPkg(\x2730 วัน (฿100)\x27, \x27pkg-30d\x27)" style="background:#111827; border:2px solid #10b981; border-radius:10px; padding:14px; cursor:pointer;">
        <div style="font-weight:bold; font-size:15px; margin-bottom:6px;">แพ็กเกจ 30 วัน</div>
        <div style="color:#00e676; font-weight:bold; font-size:20px; margin-bottom:10px;">฿100</div>
        <div style="font-size:12px; color:#cbd5e1; line-height:1.6;">
          ✓ อายุใช้งาน 30 วัน<br>
          ✓ สร้างได้ครบ KV / VMess / SSH<br>
          ✓ เรต 30/100B
        </div>
      </div>

      <div id="pkg-15d" onclick="selectPkg(\x2715 วัน (฿60)\x27, \x27pkg-15d\x27)" style="background:#111827; border:1px solid #1f2937; border-radius:10px; padding:14px; cursor:pointer;">
        <div style="font-weight:bold; font-size:15px; margin-bottom:6px;">แพ็กเกจ 15 วัน</div>
        <div style="color:#00e676; font-weight:bold; font-size:20px; margin-bottom:10px;">฿60</div>
        <div style="font-size:12px; color:#cbd5e1; line-height:1.6;">
          ✓ อายุใช้งาน 15 วัน<br>
          ✓ สร้างได้ครบ KV / VMess / SSH<br>
          ✓ เรต 15/60B
        </div>
      </div>

      <div id="pkg-7d" onclick="selectPkg(\x277 วัน (฿30)\x27, \x27pkg-7d\x27)" style="background:#111827; border:1px solid #1f2937; border-radius:10px; padding:14px; cursor:pointer;">
        <div style="font-weight:bold; font-size:15px; margin-bottom:6px;">แพ็กเกจ 7 วัน</div>
        <div style="color:#00e676; font-weight:bold; font-size:20px; margin-bottom:10px;">฿30</div>
        <div style="font-size:12px; color:#cbd5e1; line-height:1.6;">
          ✓ อายุใช้งาน 7 วัน<br>
          ✓ สร้างได้ครบ KV / VMess / SSH<br>
          ✓ เรต 7/30
        </div>
      </div>

      <div id="pkg-3h" onclick="selectPkg(\x27ทดลอง 3 ชม. (ฟรี)\x27, \x27pkg-3h\x27)" style="background:#111827; border:1px solid #1f2937; border-radius:10px; padding:14px; cursor:pointer;">
        <div style="font-weight:bold; font-size:15px; margin-bottom:6px;">ทดลอง 3 ชม.</div>
        <div style="color:#38bdf8; font-weight:bold; font-size:20px; margin-bottom:10px;">3 ชม.</div>
        <div style="font-size:12px; color:#cbd5e1; line-height:1.6;">
          ✓ ทดลองใช้งาน 3 ชม.<br>
          ✓ สร้างได้ครบ KV / VMess / SSH<br>
          ✓ test 3ชม
        </div>
      </div>
    </div>

    <div style="background:#111827; border:1px solid #1f2937; border-radius:10px; padding:16px;">
      <h2 style="margin:0 0 14px; font-size:17px; color:#f3f4f6;">สมัครสมาชิกและสร้างคีย์ (KV / VMess / SSH)</h2>
      <form onsubmit="event.preventDefault(); alert(\x27เลือกแพ็กเกจ: \x27 + document.getElementById(\x27selected-pkg\x27).value + \x27 | ประเภท: \x27 + document.getElementById(\x27key-type\x27).value);">
        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:12px; color:#9ca3af; margin-bottom:6px;">แพ็กเกจที่เลือก</label>
          <input id="selected-pkg" type="text" readonly value="30 วัน (฿100)" style="width:100%; box-sizing:border-box; background:#0b111a; color:#f9fafb; border:1px solid #374151; border-radius:6px; padding:10px; font-size:13px;">
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block; font-size:12px; color:#9ca3af; margin-bottom:6px;">ประเภทคีย์หลักที่ต้องการสร้าง</label>
          <select id="key-type" style="width:100%; box-sizing:border-box; background:#0b111a; color:#f9fafb; border:1px solid #374151; border-radius:6px; padding:10px; font-size:13px;">
            <option value="สร้างครบทั้ง 3 คีย์ (KV + VMess + SSH)">สร้างครบทั้ง 3 คีย์ (KV + VMess + SSH)</option>
            <option value="KV">KV</option>
            <option value="VMess">VMess</option>
            <option value="SSH">SSH</option>
          </select>
        </div>
        <button type="submit" style="width:100%; background:#00e676; color:#052e16; border:none; padding:10px; border-radius:6px; font-weight:bold; font-size:14px; cursor:pointer;">ยืนยันและสร้างคีย์</button>
      </form>
    </div>
  </div>

  <script>
    function selectPkg(label, id) {
      document.getElementById("selected-pkg").value = label;
      ["pkg-30d", "pkg-15d", "pkg-7d", "pkg-3h"].forEach(function(k) {
        var el = document.getElementById(k);
        if (el) {
          el.style.border = (k === id) ? "2px solid #10b981" : "1px solid #1f2937";
        }
      });
    }
    function copyAllKeys() {
      var pkg = document.getElementById("selected-pkg").value;
      var ktype = document.getElementById("key-type").value;
      var text = "HACKERSBABY | " + pkg + " | " + ktype;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function(){});
      }
      alert("คัดลอกข้อมูลคีย์เรียบร้อย: " + text);
    }
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url === "/healthz" || req.url === "/cron") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ status: "OK", port: PORT, timestamp: new Date().toISOString() }));
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(HTML_PAGE);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`HACKERSBABY storefront running on port ${PORT}`);
});
