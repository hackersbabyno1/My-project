import ast, datetime, fcntl, json, os, re, tempfile

TZ_TH = datetime.timezone(datetime.timedelta(hours=7))
HOME = os.path.expanduser("~")
GH_DIR = os.path.join(HOME, "work_new/github_render_clean")
OUT_JSON = os.path.join(GH_DIR, "new_scripts/render_files_audit_v1.json")

TARGET_FILES = ["Procfile", "app.py", "bot_core.py", "main.py"]

def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lock_path = path + ".lock"
    with open(lock_path, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".render_aud_", suffix=".tmp")
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

def inspect_py(path):
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        src = f.read()
    lines = src.splitlines()
    info = {
        "exists": True,
        "bytes": os.path.getsize(path),
        "lines": len(lines),
        "syntax_ok": False,
        "syntax_error": None,
        "imports": [],
        "functions": [],
        "classes": [],
        "flask_routes": [],
        "env_vars": sorted(set(re.findall(r"""os\.environ\.get\(\s*['"]([^'"]+)['"]|os\.getenv\(\s*['"]([^'"]+)['"]""", src))),
        "port_mentions": sorted(set(re.findall(r"""\bPORT\b|15001|25003|5000|8000|10000""", src))),
    }
    info["env_vars"] = [a or b for a, b in info["env_vars"] if (a or b)]
    try:
        tree = ast.parse(src)
        info["syntax_ok"] = True
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    info["imports"].append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                mod = node.module or ""
                info["imports"].append(f"from {mod}")
            elif isinstance(node, ast.FunctionDef):
                info["functions"].append(node.name)
            elif isinstance(node, ast.ClassDef):
                info["classes"].append(node.name)
    except SyntaxError as e:
        info["syntax_error"] = f"line {e.lineno}: {e.msg}"
    for m in re.finditer(r"""@app\.route\(\s*['"]([^'"]+)['"]""", src):
        info["flask_routes"].append(m.group(1))
    info["imports"] = list(dict.fromkeys(info["imports"]))[:30]
    info["functions"] = list(dict.fromkeys(info["functions"]))[:30]
    info["classes"] = list(dict.fromkeys(info["classes"]))[:20]
    return info

def inspect_procfile(path):
    if not os.path.exists(path):
        return {"exists": False}
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read().strip()
    return {
        "exists": True,
        "bytes": os.path.getsize(path),
        "lines": content.splitlines(),
        "raw": content,
    }

report = {
    "checked_at_th_24h": datetime.datetime.now(TZ_TH).strftime("%Y-%m-%d %H:%M:%S"),
    "admin_agent": "brother_15001",
    "repo_dir": GH_DIR,
    "policy": "read_only_audit_never_delete_or_modify_old_files",
    "files": {},
}

for fn in TARGET_FILES:
    fp = os.path.join(GH_DIR, fn)
    if not os.path.exists(fp):
        report["files"][fn] = {"exists": False}
    elif fn == "Procfile":
        report["files"][fn] = inspect_procfile(fp)
    else:
        report["files"][fn] = inspect_py(fp)

atomic_write_json(OUT_JSON, report)
print("=== ผลตรวจโค้ดสำหรับรันบน Render (อ่านอย่างเดียว ไม่แตะ/ไม่ลบของเก่า) ===")
print("ไฟล์รายงาน:", OUT_JSON)
for fn in TARGET_FILES:
    item = report["files"][fn]
    if not item.get("exists"):
        print(f"[{fn}] ไม่พบไฟล์")
        continue
    if fn == "Procfile":
        print(f"[Procfile] ({item['bytes']} bytes) -> {item['lines']}")
    else:
        print(
            f"[{fn}] lines={item['lines']} | syntax_ok={item['syntax_ok']}"
            + (f" ({item['syntax_error']})" if item.get("syntax_error") else "")
        )
        print(f"   routes={item['flask_routes']} | env={item['env_vars']} | ports={item['port_mentions']}")
        print(f"   funcs={item['functions'][:12]} | classes={item['classes'][:8]}")
