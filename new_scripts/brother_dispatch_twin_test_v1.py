import datetime, fcntl, json, os, subprocess, tempfile

TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
HOME = os.path.expanduser("~")
GH_DIR = os.path.join(HOME, "work_new/github_render_clean")
CORE_SRC = os.path.join(GH_DIR, "new_scripts/bot_core_render_v1.py")
REPORT_OUT = os.path.join(GH_DIR, "new_scripts/brother_twin_dispatch_report_v1.json")

TWIN_HOST = os.environ.get("TWIN_BOT_HOST", "162.35.47.89")
TWIN_USER = os.environ.get("TWIN_SSH_USER", "root")
TWIN_DST_DIR = "/root/work_new/bot_02_debian/test_render_v1"

def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lock_path = path + ".lock"
    with open(lock_path, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".disp_", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as tf:
                json.dump(data, tf, ensure_ascii=False, indent=2)
            os.replace(tmp_path, path)
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
            fcntl.flock(lf.fileno(), fcntl.LOCK_UN)

remote_test_script = r"""import ast, datetime, fcntl, importlib.util, json, os, tempfile

TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
BASE_DIR = "/root/work_new/bot_02_debian/test_render_v1"
CORE_PATH = os.path.join(BASE_DIR, "bot_core_render_v1.py")
RES_PATH = os.path.join(BASE_DIR, "debian_test_result_v1.json")

def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lock_path = path + ".lock"
    with open(lock_path, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".dtst_", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as tf:
                json.dump(data, tf, ensure_ascii=False, indent=2)
            os.replace(tmp_path, path)
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
            fcntl.flock(lf.fileno(), fcntl.LOCK_UN)

with open(CORE_PATH, "r", encoding="utf-8") as f:
    ast.parse(f.read())

seed_mem = os.path.join(tempfile.gettempdir(), "debian_sandbox_mem_v1.json")
with open(seed_mem, "w", encoding="utf-8") as sm:
    json.dump({"version": "debian_sandbox_v1", "chat_history": []}, sm, ensure_ascii=False, indent=2)

spec = importlib.util.spec_from_file_location("bot_core_render_v1", CORE_PATH)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

r1 = mod.handle_message("จำได้ไหมความจำล่าสุด", source_env="twin_25003_debian", mem_path=seed_mem)
r2 = mod.handle_message("รักนะ", source_env="twin_25003_debian", mem_path=seed_mem)
r3 = mod.handle_message("บอทพี่สั่งน้องทดสอบเรียบร้อย", source_env="twin_25003_debian", mem_path=seed_mem)

out = {
    "executed_by": "brother_15001_remote_command",
    "twin_host": os.uname().nodename,
    "temp_dir": tempfile.gettempdir(),
    "syntax_ok": True,
    "replies": [r1, r2, r3],
}
atomic_write_json(RES_PATH, out)
print(json.dumps(out, ensure_ascii=False))
"""

def run_cmd(cmd, timeout=15):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout.strip(), p.stderr.strip()
    except Exception as e:
        return 1, "", str(e)

now_th = datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d %H:%M:%S")
target = f"{TWIN_USER}@{TWIN_HOST}"

# บอทพี่ส่งคำสั่งสร้างโฟลเดอร์ + วางโค้ด + รันเทสที่ฝั่งน้องอัตโนมัติ
remote_cmd = (
    f"mkdir -p {TWIN_DST_DIR} && "
    f"cat << 'PYEOF' > {TWIN_DST_DIR}/bot_core_render_v1.py\n"
    + open(CORE_SRC, "r", encoding="utf-8").read()
    + f"\nPYEOF\n"
    f"cat << 'PYTST' > {TWIN_DST_DIR}/run_twin_sandbox_v1.py\n"
    + remote_test_script
    + f"\nPYTST\n"
    f"python3 {TWIN_DST_DIR}/run_twin_sandbox_v1.py"
)

rc, out, err = run_cmd([
    "ssh",
    "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=5",
    "-o", "StrictHostKeyChecking=no",
    target,
    remote_cmd,
], timeout=25)

report = {
    "dispatched_at_th_24h": now_th,
    "admin_agent": "brother_15001",
    "twin_target": target,
    "dst_dir": TWIN_DST_DIR,
    "ssh_exit_code": rc,
    "stdout": out,
    "stderr": err,
    "policy": "brother_orders_twin_only_never_delete_or_modify_old_files",
}
atomic_write_json(REPORT_OUT, report)

print("=== บอทพี่ (:15001) สั่งงานและให้บอทน้องทดสอบ (ไม่แตะ/ไม่ลบของเก่า) ===")
print("ปลายทาง:", target, "->", TWIN_DST_DIR)
print("สถานะคำสั่ง (exit_code):", rc)
if out:
    print("ผลลัพธ์จากฝั่งน้อง:", out)
if err:
    print("ข้อความแจ้งเตือน/SSH:", err)
print("บันทึกรายงานที่บอทพี่:", REPORT_OUT)
