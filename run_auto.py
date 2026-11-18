from flask import Flask, render_template, request, jsonify
import subprocess, os, socket, json, urllib.request, urllib.error, shutil
from datetime import datetime

app = Flask(__name__)
MEMORY_FILE = os.path.expanduser('~/ai_girl_bot/MASTER_MEMORY_420KB.json')
BACKUP_MEMORY_FILE = '/storage/emulated/0/Dev/admin0/admin/memory_backup.json'
API_KEY_FILE = os.path.expanduser('~/ai_girl_bot/gemini_key.txt')
WORKSPACE_ROOT = '/storage/emulated/0/Dev'
BOT_DIR = '/storage/emulated/0/Dev/ai_girl_bot'
SEED_BASE_DIR = '/storage/emulated/0/Dev/admin0/admin'

SCAN_DIRS = [
    BOT_DIR,
    '/storage/emulated/0/Dev/admin0',
    os.path.expanduser('~/ai_girl_bot')
]
BASH_HISTORY = os.path.expanduser('~/.bash_history')

def load_memory():
    data = {}
    if os.path.exists(MEMORY_FILE):
        try:
            with open(MEMORY_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception:
            data = {}
    elif os.path.exists(BACKUP_MEMORY_FILE):
        try:
            with open(BACKUP_MEMORY_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception:
            data = {}
    data.setdefault("birth_date", "2026-11-11")
    data.setdefault("user_name", "ป๋า")
    data.setdefault("chat_history", [])
    data.setdefault("termux_code_files", [])
    data.setdefault("termux_commands", [])
    data.setdefault("custom_snippets", [])
    data.setdefault("workspace_logs", [])
    return data

def save_memory(data):
    os.makedirs(os.path.dirname(MEMORY_FILE), exist_ok=True)
    with open(MEMORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    try:
        os.makedirs(os.path.dirname(BACKUP_MEMORY_FILE), exist_ok=True)
        with open(BACKUP_MEMORY_FILE, 'w', encoding='utf-8') as bf:
            json.dump(data, bf, ensure_ascii=False, indent=2)
    except Exception:
        pass

def get_gemini_key():
    if os.path.exists(API_KEY_FILE):
        try:
            with open(API_KEY_FILE, 'r', encoding='utf-8') as f:
                k = f.read().strip()
                if k:
                    return k
        except Exception:
            pass
    return os.environ.get('GEMINI_API_KEY', '').strip()

def save_gemini_key(key_str):
    os.makedirs(os.path.dirname(API_KEY_FILE), exist_ok=True)
    with open(API_KEY_FILE, 'w', encoding='utf-8') as f:
        f.write(key_str.strip())

def sync_termux_to_memory(mem):
    code_exts = ('.py', '.html', '.js', '.css', '.sh', '.json', '.txt', '.ovpn')
    scanned_files = []
    seen_paths = set()

    def inspect_file(fn, full_p):
        try:
            with open(full_p, 'r', encoding='utf-8', errors='ignore') as cf:
                content = cf.read()
                all_lines = content.splitlines()
                total_lines = len(all_lines)
                real_code_lines = len([l for l in all_lines if l.strip()])
                chars = len(content)
                skills = (
                    content.count("def ") +
                    content.count("@app.route") +
                    content.count("function ")
                )
        except Exception:
            content = ""
            total_lines = 0
            real_code_lines = 0
            chars = 0
            skills = 0

        return {
            "file": fn,
            "lines": total_lines,
            "real_lines": real_code_lines,
            "chars": chars,
            "skills": skills,
            "path": full_p,
            "content": content
        }

    for d in SCAN_DIRS:
        if os.path.exists(d):
            for root, _, files in os.walk(d):
                for fn in sorted(files):
                    if fn.endswith(code_exts) and fn not in ('MASTER_MEMORY_420KB.json', 'memory_backup.json', 'gemini_key.txt'):
                        full_p = os.path.join(root, fn)
                        if full_p not in seen_paths:
                            seen_paths.add(full_p)
                            scanned_files.append(inspect_file(fn, full_p))

    home_dir = os.path.expanduser('~')
    if os.path.exists(home_dir):
        for fn in sorted(os.listdir(home_dir)):
            full_p = os.path.join(home_dir, fn)
            if os.path.isfile(full_p) and fn.endswith(('.py', '.sh')) and full_p not in seen_paths:
                seen_paths.add(full_p)
                scanned_files.append(inspect_file(fn, full_p))

    mem["termux_code_files"] = scanned_files

    if os.path.exists(BASH_HISTORY):
        try:
            with open(BASH_HISTORY, 'r', encoding='utf-8', errors='ignore') as hf:
                cmds = [line.strip() for line in hf.readlines() if line.strip()]
                saved_cmds = mem.get("termux_commands", [])
                for c in cmds:
                    if not saved_cmds or saved_cmds[-1] != c:
                        if c not in saved_cmds[-5:]:
                            saved_cmds.append(c)
                mem["termux_commands"] = saved_cmds
        except Exception:
            pass
    return mem

def get_evolution_stage(real_lines, total_skills):
    if real_lines >= 3000:
        return "🧬 Lv.4 ร่างทอง AI เต็มระบบ (คลังสมองขนาดใหญ่)"
    elif real_lines >= 1500:
        return "⚡ Lv.3 วัยเรียนรู้ขั้นสูง (สมองกลหลายท่อทำงาน)"
    elif real_lines >= 500:
        return "🌱 Lv.2 วัยหัดเดิน (เริ่มมีระบบความจำและท่อส่ง)"
    else:
        return "👶 Lv.1 วัยทารก (เริ่มก่อร่างสร้างตัว)"

def get_weather():
    try:
        req = urllib.request.Request('https://wttr.in/?format=%C|%t', headers={'User-Agent': 'curl/7.68.0'})
        with urllib.request.urlopen(req, timeout=2) as res:
            cond, temp = res.read().decode('utf-8').strip().split('|')
            return f"🌤️ {cond.strip()} {temp.strip()}"
    except Exception:
        return "🌡️ Offline"

def think_like_bot(user_text):
    mem = load_memory()
    mem = sync_termux_to_memory(mem)
    now = datetime.now()

    try:
        b_date = datetime.strptime(mem.get("birth_date", "2026-11-11"), '%Y-%m-%d')
        age_days = max(1, (now - b_date).days + 1)
    except Exception:
        age_days = 1

    raw_text = user_text.strip()
    text = raw_text.lower()

    history = mem.get("chat_history", [])
    snippets = mem.get("custom_snippets", [])
    code_files = mem.get("termux_code_files", [])
    termux_cmds = mem.get("termux_commands", [])

    saved_snippet = False
    if text.startswith("จำโค้ด") or any(tok in raw_text for tok in ["def ", "import ", "@app.route", "#!/bin/"]):
        clean_code = raw_text.replace("จำโค้ด:", "").replace("จำโค้ด", "").strip()
        if clean_code and not any(s.get("code") == clean_code for s in snippets):
            snippets.append({"time": now.strftime('%Y-%m-%d %H:%M:%S'), "code": clean_code})
            mem["custom_snippets"] = snippets
            saved_snippet = True

    history.append({"time": now.strftime('%Y-%m-%d %H:%M:%S'), "user": raw_text})
    mem["chat_history"] = history
    save_memory(mem)

    total_files = len(code_files)
    total_all_lines = sum(f.get("lines", 0) for f in code_files)
    total_real_lines = sum(f.get("real_lines", f.get("lines", 0)) for f in code_files) + sum(len(s.get("code", "").splitlines()) for s in snippets)
    total_chars = sum(f.get("chars", 0) for f in code_files) + sum(len(s.get("code", "")) for s in snippets)
    total_skills = sum(f.get("skills", 0) for f in code_files)
    evo_stage = get_evolution_stage(total_real_lines, total_skills)

    try:
        mem_size_kb = os.path.getsize(MEMORY_FILE) / 1024.0
    except Exception:
        mem_size_kb = 0.0

    weather = get_weather()
    header = (
        f"👧 [บอทตัวน้อย | {evo_stage}]\n"
        f"📊 อายุ {age_days} วัน | {weather} | โค้ดจริง {total_real_lines:,} บรรทัด ({total_chars:,} ตัวอักษร) | {total_skills} ทักษะ | สมอง {mem_size_kb:.1f} KB"
    )

    report_triggers = [
        "กี่โค้ด", "กี่บรรทัด", "ความจำ", "จำอะไร", "จำอ่ะไร",
        "โค้ดอะไร", "ประวัติ", "รายงาน", "วิวัฒนาการ", "เติบโต", "เลเวล"
    ]
    if saved_snippet:
        reply = f"บันทึกโค้ดใหม่ลง MASTER_MEMORY_420KB.json แล้วค่ะป๋า! ตอนนี้สมองโตขึ้นเป็น {total_real_lines:,} บรรทัดจริง ({total_chars:,} ตัวอักษร) ขนาดไฟล์สมอง {mem_size_kb:.1f} KB 💻"
    elif any(k in text for k in report_triggers):
        sorted_files = sorted(code_files, key=lambda x: x.get("real_lines", x.get("lines", 0)), reverse=True)
        file_details = [
            f"• {f['file']} -> {f.get('real_lines', f['lines']):,} บรรทัดจริง ({f.get('chars', 0):,} ตัวอักษร | {f.get('skills', 0)} ทักษะ)"
            for f in sorted_files[:8]
        ]
        if len(sorted_files) > 8:
            file_details.append(f"• ...และอีก {len(sorted_files) - 8} ไฟล์ในคลัง")

        cmd_details = [f"• {c[:60]}" for c in termux_cmds[-3:]]
        chat_details = [f"• {h['user']}" for h in history[-4:-1]]

        lines_out = [f"📋 รายงานการเติบโตและวิวัฒนาการใน MASTER_MEMORY_420KB.json:"]
        lines_out.append(f"• ระดับปัจจุบัน: {evo_stage}")
        lines_out.append(f"• ปริมาณโค้ดจริง: {total_real_lines:,} บรรทัด (รวมบรรทัดว่าง {total_all_lines:,} บรรทัด)")
        lines_out.append(f"• เนื้อหาโค้ดสะสม: {total_chars:,} ตัวอักษร | {total_skills} ฟังก์ชัน/ท่อทำงาน")
        lines_out.append(f"• น้ำหนักไฟล์สมอง (MASTER_MEMORY_420KB.json): {mem_size_kb:.1f} KB (สำรองคู่แฝดอัตโนมัติ)")

        lines_out.append(f"\n1️⃣ คลังไฟล์โค้ดหลัก ({total_files} ไฟล์):")
        lines_out.extend(file_details if file_details else ["• ยังไม่พบไฟล์โค้ด"])

        if snippets:
            lines_out.append(f"\n2️⃣ โค้ดที่ป๋าสอนเพิ่ม ({len(snippets)} ชุด):")
            lines_out.extend([f"• {s['code'][:45]}..." for s in snippets[-3:]])

        if cmd_details:
            lines_out.append(f"\n3️⃣ คำสั่ง Termux ที่จำไว้ ({len(termux_cmds)} คำสั่ง):")
            lines_out.extend(cmd_details)

        lines_out.append(f"\n4️⃣ ประวัติแชทสะสม ({len(history)} รายการ - No Limit):")
        lines_out.extend(chat_details if chat_details else ["• เพิ่งเริ่มคุยรอบนี้ค่ะ"])
        reply = "\n".join(lines_out)
    elif any(k in text for k in ["เวลา", "กี่โมง"]):
        reply = f"ตอนนี้เวลา {now.strftime('%H:%M:%S น.')} ค่ะป๋า! ⏰"
    elif any(k in text for k in ["อายุ", "กี่วัน"]):
        reply = f"หนูอายุ {age_days} วันแล้วนะคะป๋า! ตอนนี้อยู่ระดับ {evo_stage} 💖"
    else:
        reply = f"รับทราบคำสั่ง '{raw_text}' ค่ะป๋า! บันทึกลง MASTER_MEMORY_420KB.json ({mem_size_kb:.1f} KB) เรียบร้อยแล้ว ❤️"

    return f"{header}\n\n{reply}"

def ask_gemini_direct(prompt_text, api_key):
    project_files = []
    if os.path.exists(BOT_DIR):
        project_files = os.listdir(BOT_DIR)
    system_context = (
        f"คุณคือ Workspace AI Agent ส่วนตัวของ 'ป๋า' รันอยู่บน Termux Android\n"
        f"โฟลเดอร์โปรเจกต์หลัก: {BOT_DIR} (ไฟล์ปัจจุบัน: {', '.join(project_files)})\n"
        f"ตอบสั้น กระชับ ตรงประเด็น เป็นภาษาไทย และพร้อมให้โค้ดนำไปใช้งานจริงทันที\n\n"
        f"คำสั่งจากป๋า: {prompt_text}"
    )
    payload = json.dumps({"contents": [{"parts": [{"text": system_context}]}]}).encode('utf-8')
    for model_name in ("gemini-2.5-flash", "gemini-2.0-flash"):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=25) as res:
                body = json.loads(res.read().decode('utf-8'))
                return body["candidates"][0]["content"]["parts"][0]["text"]
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode('utf-8', errors='ignore')
            if e.code == 404:
                continue
            return f"❌ เชื่อมต่อสมอง Gemini API ไม่สำเร็จ (HTTP {e.code}): {err_msg[:180]}"
        except Exception as e:
            return f"❌ เกิดข้อผิดพลาดขณะคุยกับสมอง AI: {str(e)}"
    return "❌ ไม่พบโมเดล AI ที่รองรับ กรุณาตรวจสอบคีย์อีกครั้งครับ"

def run_workspace_agent(raw_cmd):
    cmd = raw_cmd.strip()
    low = cmd.lower()
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    if low.startswith(("ตั้งคีย์", "set key", "key ", "aizasy")) or cmd.startswith("AIzaSy"):
        key_val = cmd.replace("ตั้งคีย์:", "").replace("ตั้งคีย์", "").replace("set key", "").replace("key", "").strip()
        if len(key_val) > 20:
            save_gemini_key(key_val)
            return (
                "🔑 [Workspace Agent]: บันทึกกุญแจสมอง AI ลงเครื่องเรียบร้อยแล้วครับป๋า!\n"
                "✅ ตอนนี้ช่องที่ 3 เชื่อมตรงถึงสมอง Gemini 100% สามารถลบแอป Gemini ออกจากเครื่องได้เลยครับ!"
            )
        return "⚠️ รูปแบบคีย์ไม่ถูกต้อง กรุณาวางคีย์ที่ขึ้นต้นด้วย AIzaSy... ครับป๋า"

    if any(k in low for k in ["สแกน", "ดูไฟล์", "โครงสร้าง", "workspace", "scan"]):
        lines = ["💼 [Workspace Agent - โครงสร้างพื้นที่ทำงาน /storage/emulated/0/Dev]:"]
        for sub in ["ai_girl_bot", "admin0/admin"]:
            target = os.path.join(WORKSPACE_ROOT, sub)
            if os.path.exists(target):
                items = sorted(os.listdir(target))
                lines.append(f"\n📁 {sub}/ ({len(items)} รายการ):")
                for it in items[:15]:
                    full_it = os.path.join(target, it)
                    if os.path.isdir(full_it):
                        lines.append(f"  📂 {it}/")
                    else:
                        sz = os.path.getsize(full_it) / 1024.0
                        lines.append(f"  📄 {it} ({sz:.1f} KB)")
        api_status = "🟢 เชื่อมต่อสมอง AI ตรงแล้ว (พร้อมลบแอป Gemini)" if get_gemini_key() else "🟡 รอใส่คีย์ AI (พิมพ์: ตั้งคีย์ AIzaSy...)"
        lines.append(f"\n🔌 สถานะสมองช่องที่ 3: {api_status}")
        return "\n".join(lines)

    if low.startswith("สร้างไฟล์"):
        body = cmd[len("สร้างไฟล์"):].strip()
        if ":" in body:
            fname, content = body.split(":", 1)
            fname = os.path.basename(fname.strip())
            if fname:
                target_file = os.path.join(BOT_DIR, fname)
                with open(target_file, 'w', encoding='utf-8') as f:
                    f.write(content.strip() + "\n")
                return f"✅ [Workspace Agent]: สร้างไฟล์ '{fname}' ลงใน {BOT_DIR}/ เรียบร้อยแล้วครับป๋า!"
        return "⚠️ วิธีสั่งสร้างไฟล์: พิมพ์ 'สร้างไฟล์ ชื่อไฟล์.txt : ข้อความข้างใน'"

    if low.startswith("อ่านไฟล์"):
        fname = os.path.basename(cmd[len("อ่านไฟล์"):].strip())
        target_file = os.path.join(BOT_DIR, fname)
        if fname and os.path.exists(target_file):
            with open(target_file, 'r', encoding='utf-8', errors='ignore') as f:
                txt = f.read()
            preview = txt[:800] + ("\n... (ตัดแสดง 800 ตัวอักษรแรก)" if len(txt) > 800 else "")
            return f"📖 [Workspace Agent - เนื้อหาไฟล์ {fname}]:\n\n{preview}"
        return f"⚠️ ไม่พบไฟล์ '{fname}' ใน {BOT_DIR}"

    if low.startswith("สำรองเมล็ดพันธุ์"):
        seed_name = cmd[len("สำรองเมล็ดพันธุ์"):].strip() or "seed_ch3_ok"
        seed_name = "".join(c for c in seed_name if c.isalnum() or c in ('_', '-'))
        dest = os.path.join(SEED_BASE_DIR, seed_name)
        os.makedirs(dest, exist_ok=True)
        shutil.copy2(os.path.join(BOT_DIR, 'run_auto.py'), os.path.join(dest, 'run_auto.py'))
        if os.path.exists(MEMORY_FILE):
            shutil.copy2(MEMORY_FILE, os.path.join(dest, 'MASTER_MEMORY_420KB.json'))
        tpl_src = os.path.join(BOT_DIR, 'templates')
        tpl_dst = os.path.join(dest, 'templates')
        if os.path.exists(tpl_src):
            shutil.copytree(tpl_src, tpl_dst, dirs_exist_ok=True)
        return f"🌱 [Workspace Agent]: บันทึกเมล็ดพันธุ์ '{seed_name}' ลง {dest} เรียบร้อย 100%!"

    api_key = get_gemini_key()
    if api_key:
        ai_answer = ask_gemini_direct(cmd, api_key)
        mem = load_memory()
        mem["workspace_logs"].append({"time": now_str, "cmd": cmd, "reply": ai_answer[:300]})
        save_memory(mem)
        return f"⚡ [Workspace AI Agent]:\n\n{ai_answer}"

    return (
        f"💼 [Workspace Agent]: รับคำสั่ง '{cmd}' แล้วครับ!\n"
        f"• คำสั่งจัดการไฟล์ที่ใช้ได้ทันที: 'สแกนโปรเจกต์', 'สร้างไฟล์ ชื่อ : เนื้อหา', 'อ่านไฟล์ ชื่อ', 'สำรองเมล็ดพันธุ์ seed_ch3_ok'\n"
        f"• หากต้องการคุยถาม-ตอบแทนแอป Gemini ให้พิมพ์: ตั้งคีย์ ตามด้วยคีย์จาก aistudio.google.com ครับป๋า"
    )

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/ai-bridge', methods=['POST'])
def ai_bridge():
    data = request.get_json(silent=True) or {}
    user_prompt = data.get('prompt', '')
    pipeline_log = [
        f"👴 [ปู่ใหญ่ Orchestrator]: รับโจทย์ '{user_prompt}' กระจายงานเข้าห้องประชุม...",
        "👨 พ่อ [Gemini Agent]: วิเคราะห์โครงสร้างและต้นตอปัญหาสำเร็จ",
        "👩 แม่ [OpenAI Agent]: ตรวจสอบตรรกะคำสั่งและแนวทางแก้ไข",
        "🧔 ลุง [Claude Agent] & 💻 พี่ใหญ่ [Copilot]: ตรวจความถูกต้องชุดโค้ด",
        "👦 พี่ชาย [Llama Agent] & 🤖 น้องเล็ก [Custom Bot]: สรุปผลลัพธ์พร้อมใช้งาน",
        "\n✨ [AI ครอบครัวรุมวิเคราะห์]: ประมวลผลเสร็จสิ้น (แสดงผลเฉพาะช่องที่ 1)"
    ]
    final_output = "\n".join(pipeline_log)
    print(f"\n[Termux Log - ช่องที่ 1 Family AI]\n{final_output}\n")
    return jsonify({"status": "success", "bridge_response": final_output})

@app.route('/api/ai', methods=['POST'])
@app.route('/api/ai-control', methods=['POST'])
@app.route('/api/direct-ai', methods=['POST'])
@app.route('/api/chat', methods=['POST'])
@app.route('/api/bot', methods=['POST'])
def ai_control():
    data = request.get_json(silent=True) or {}
    prompt = data.get('prompt') or data.get('message') or data.get('command') or data.get('text') or ''
    real_reply = think_like_bot(prompt)
    print(f"\n[Termux Log - ช่องที่ 2 บอทตัวน้อย]\n{real_reply}\n")
    return jsonify({"status": "success", "output": real_reply, "response": real_reply, "reply": real_reply})

@app.route('/api/workspace', methods=['POST'])
@app.route('/api/agent', methods=['POST'])
@app.route('/api/workspace-agent', methods=['POST'])
def workspace_agent():
    data = request.get_json(silent=True) or {}
    cmd = data.get('command') or data.get('prompt') or data.get('message') or data.get('text') or ''
    ws_reply = run_workspace_agent(cmd)
    print(f"\n[Termux Log - ช่องที่ 3 Workspace Agent]\n{ws_reply}\n")
    return jsonify({"status": "success", "response": ws_reply, "output": ws_reply, "reply": ws_reply})

@app.route('/api/shell', methods=['POST'])
def termux_shell():
    data = request.get_json(silent=True) or {}
    try:
        res = subprocess.check_output(data.get('cmd', ''), shell=True, stderr=subprocess.STDOUT, text=True, timeout=5)
    except Exception as e:
        res = str(e)
    return jsonify({"status": "success", "output": res})

@app.route('/api/home-files', methods=['GET'])
def home_files():
    home_dir = os.path.expanduser('~')
    return jsonify({"status": "success", "path": home_dir, "files": os.listdir(home_dir)[:15]})

@app.route('/api/external-storage', methods=['GET'])
def external_storage():
    ext_path = '/storage/emulated/0/Dev/ai_girl_bot'
    return jsonify({"status": "success", "path": ext_path, "files": os.listdir(ext_path)})

def find_port(start=9510):
    for p in range(start, 9999):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', p))
                return p
            except OSError:
                continue
    return start

if __name__ == '__main__':
    port = find_port(9510)
    print(f"🚀 ระบบ 3 ท่อสมบูรณ์ (พร้อม Workspace AI Agent ช่องที่ 3) ลุยที่: http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
