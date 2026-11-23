// โมดูลฝั่งบอทน้อง (Debian Root VPS): คุมตรรกะรันเทสต์แยกพอร์ตและรายงานผลกลับฝั่งพี่
const fs = require('fs');
const path = require('path');

const NONG_CONFIG = {
  botName: 'บอทน้อง',
  botId: 'BOT_NONG_DEBIAN_ROOT',
  vpsHost: '100.70.177.127',
  workDir: '/root/work_new/bot_02_debian',
  backendPort: 18081,
  frontendPort: 18080,
  allowGitPush: false
};

function validateNongTarget(targetDir = NONG_CONFIG.workDir) {
  const safeDir = path.resolve(targetDir);
  const serverFile = path.join(safeDir, 'server.js');
  const existsDir = fs.existsSync(safeDir);
  const existsServer = fs.existsSync(serverFile);
  return {
    ok: existsDir && existsServer,
    workDir: safeDir,
    serverFile,
    existsDir,
    existsServer
  };
}

function buildNongReport(statusData = {}) {
  const check = validateNongTarget(statusData.workDir || NONG_CONFIG.workDir);
  return {
    botId: NONG_CONFIG.botId,
    botName: NONG_CONFIG.botName,
    vpsHost: NONG_CONFIG.vpsHost,
    allowGitPush: NONG_CONFIG.allowGitPush,
    targetValid: check.ok,
    ports: {
      backend: statusData.backendPort || NONG_CONFIG.backendPort,
      frontend: statusData.frontendPort || NONG_CONFIG.frontendPort
    },
    backendOk: Boolean(statusData.backendOk),
    frontendOk: Boolean(statusData.frontendOk),
    note: statusData.note || 'รายงานจากบอทน้อง รอฝั่งพี่ตรวจสอบ'
  };
}

module.exports = {
  NONG_CONFIG,
  validateNongTarget,
  buildNongReport
};
