const fs = require("fs");
const path = require("path");

function superviseNongModules(opts = {}) {
  const targetDir = path.resolve(opts.nongDir || "/storage/emulated/0/Dev/บอทน้อง");
  const memPath = path.resolve(opts.memFile || "/storage/emulated/0/Dev/ai_girl_bot/memory.json");
  const targetCount = Number(opts.targetCount || 20);

  const existsDir = fs.existsSync(targetDir);
  const allFiles = existsDir ? fs.readdirSync(targetDir).sort() : [];
  const jsFiles = allFiles.filter((f) => f.endsWith(".js"));
  const missingTo20 = Math.max(0, targetCount - jsFiles.length);
  const memExists = fs.existsSync(memPath);
  const memBytes = memExists ? fs.statSync(memPath).size : 0;

  return {
    supervisor: "BOT_BROTHER_15001",
    controlledTarget: "BOT_NONG_DEBIAN_ROOT",
    nongDir: targetDir,
    existsDir,
    totalFiles: allFiles.length,
    jsModuleCount: jsFiles.length,
    targetModuleGoal: targetCount,
    missingTo20,
    completed20: jsFiles.length >= targetCount,
    canonicalMemory: { path: memPath, exists: memExists, bytes: memBytes },
    untouchedPorts: [18080, 18081],
    allowGitPush: false
  };
}

module.exports = { superviseNongModules };
