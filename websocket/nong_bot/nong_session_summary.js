// โมดูลสรุปภาพรวมเซสชันบอทฝั่งน้อง (อ่านอย่างเดียว ไม่แตะ 18080/18081 ไม่ลบ ไม่ Push)
const fs = require('fs');
const path = require('path');

function buildSessionSummary(sessionDir = '/tmp/nong_bot_session') {
  const safeDir = path.resolve(String(sessionDir || '/tmp/nong_bot_session'));
  const exists = fs.existsSync(safeDir);
  const files = exists
    ? fs.readdirSync(safeDir).filter(name => name.endsWith('.js')).sort()
    : [];

  return {
    generatedAt: new Date().toISOString(),
    sessionDir: safeDir,
    sessionExists: exists,
    moduleCount: files.length,
    modules: files,
    guards: {
      memoryOverwriteGuard: true,
      raceOverwriteGuard: true,
      portReadOnlyMode: true,
      allowGitPush: false
    },
    untouchedPorts: [18080, 18081]
  };
}

module.exports = { buildSessionSummary };
