// โมดูลตรวจความครบถ้วนและไวยากรณ์ของชุดโมดูลในเซสชัน (อ่านอย่างเดียว ไม่ลบ ไม่แตะ 18080/18081)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function inspectModuleManifest(sessionDir = '/tmp/nong_bot_session') {
  const safeDir = path.resolve(String(sessionDir || '/tmp/nong_bot_session'));
  if (!fs.existsSync(safeDir)) {
    return { ok: false, reason: 'missing_session_dir', sessionDir: safeDir, modules: [] };
  }

  const files = fs.readdirSync(safeDir)
    .filter(name => name.endsWith('.js'))
    .sort();

  const checked = files.map((fileName) => {
    const fullPath = path.join(safeDir, fileName);
    try {
      execFileSync('node', ['--check', fullPath], { stdio: 'pipe', timeout: 5000 });
      return { file: fileName, syntaxOk: true };
    } catch (err) {
      return {
        file: fileName,
        syntaxOk: false,
        error: err && err.stderr ? String(err.stderr).trim() : 'syntax_check_failed'
      };
    }
  });

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    sessionDir: safeDir,
    totalModules: checked.length,
    allSyntaxOk: checked.every(item => item.syntaxOk),
    modules: checked
  };
}

module.exports = { inspectModuleManifest };
