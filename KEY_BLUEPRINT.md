# KEY_BLUEPRINT.md — พิมพ์เขียวระบบคีย์ 1-5 และท่อสัญญาณ (VLESS / VMess / SSH/WS)

## 1. ภาพรวมและตำแหน่งไฟล์สำคัญ (สำหรับบอททุกตัว)
- **ไฟล์เซิร์ฟเวอร์หลัก:** `server.js`
  - เครื่องหลัก (`/storage/emulated/0/Dev/server.js`)
  - รีโป GitHub (`/data/data/com.termux/files/home/ai_backup_safe/admin_seeds/กิตฮับล่าสุด/My-project/server.js`)
  - บอทน้อง Debian (`root@100.70.177.127:/root/work_new/bot_02_debian/server.js`)
- **หน้าแอดมิน:** `/10admin` (พอร์ตทดสอบบนเครื่อง `25021`, โฮสต์หลัก `my-project-websocket.onrender.com`)
- **กฎเหล็กของแอดมิน:** ห้ามลบไฟล์เก่า ห้ามใช้คำสั่งลบถาวร (`rm`) ตรวจ Path และตัวแปรเสมอ ค่อยๆ ทำทีละโมดูล

## 2. โครงสร้างชุดคีย์ 1-5 และรูปแบบที่สร้างจากหน้าเว็บ
แต่ละคีย์ (`id: 1` ถึง `5`) เก็บ `UUID`, ชื่อคีย์ (`name`), และวันหมดอายุ (`expiresAt`) แยกกัน บนหน้าแอดมินมีปุ่ม `[📋 คัดลอก ▾]` ให้เลือก 3 แบบ:
1. **VLESS** -> `vless://<uuid>@<host>:443?path=%2Fvless&security=tls&encryption=none&type=ws&host=<host>#<name>` (เส้นทาง `/vless`)
2. **VMess** -> `vmess://<base64_json>` โดยกำหนด `net: "ws"`, `path: "/vmess"`, `tls: "tls"`, `port: "443"` (เส้นทาง `/vmess`)
3. **SSH/WS** -> JSON ระบุ `key_id`, `label`, `uuid`, `host`, `ws_port: 80`, `tls_port: 443`, `ssh_port: 22`, `paths: ["/vless", "/vmess", "/ssh"]` (เส้นทาง `/ssh`)

| id | ชื่อ / ผู้ใช้งาน | บทบาท / เวลา | รูปแบบที่คัดลอกได้ | เส้นทางท่อสัญญาณ |
| :--- | :--- | :--- | :--- | :--- |
| 1 | ป๋า (Master) | แอดมินหลักถาวร | VLESS / VMess / SSH/WS | /vless, /vmess, /ssh |
| 2 | test1 | ตามเวลาที่ตั้ง (+เพิ่ม/-ลด) | VLESS / VMess / SSH/WS | /vless, /vmess, /ssh |
| 3 | test2 | ตามเวลาที่ตั้ง (+เพิ่ม/-ลด) | VLESS / VMess / SSH/WS | /vless, /vmess, /ssh |
| 4 | test3 | ตามเวลาที่ตั้ง (+เพิ่ม/-ลด) | VLESS / VMess / SSH/WS | /vless, /vmess, /ssh |
| 5 | test4 | ตามเวลาที่ตั้ง (+เพิ่ม/-ลด) | VLESS / VMess / SSH/WS | /vless, /vmess, /ssh |

## 3. ขั้นตอนที่ทำเสร็จแล้ว vs ขั้นตอนที่บอทตัวถัดไปต้องทำต่อ
- [x] **ขั้นที่ 1 (เสร็จแล้ว):** สร้างเมนูสเต็ปปุ่มคัดลอก 3 แบบ (VLESS, VMess, SSH/WS) แนบ `data-uuid` และ `data-name` ครบทั้งคีย์ `1-5` ใน `server.js` และซิงค์ตรงกันทุกจุด
- [ ] **ขั้นที่ 2 (งานถัดไป — เดินท่อเครื่องยนต์หลังบ้าน):**
  1. เปิดดูโค้ดช่วงท้าย `server.js` (ตั้งแต่บรรทัด `270` จนจบไฟล์ตรงส่วน `server.on('upgrade', ...)`).
  2. ตรวจสอบตัวเช็กสิทธิ์ใน `KEYS` ให้ตรวจ `UUID` และเช็กวันหมดอายุ (`expiresAt`) ของทั้งคีย์ `1-5` ได้ครบทุกโปรโตคอล.
  3. เพิ่มการรองรับเส้นทาง WebSocket `/vmess` และ `/ssh` ใน `server.on('upgrade')` ควบคู่กับ `/vless` เดิม เพื่อถอดหัวแพ็กเก็ตและส่งต่อท่อ TCP (`net.connect`) ไปปลายทางจริง.
  4. ทดสอบไวยากรณ์ด้วย `node -c server.js`, รีสตาร์ทพอร์ต `25021`, ซิงค์ไฟล์ให้ตรงกันทั้ง 3 จุด แล้วค่อยขออนุญาตแอดมินก่อน Push ขึ้น GitHub.
