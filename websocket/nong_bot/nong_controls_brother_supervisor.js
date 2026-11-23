const fs = require("fs");
const path = require("path");

function superviseBrotherTo20(opts = {}) {
  const targetBroDir = path.resolve(opts.broDir || "/storage/emulated/0/Dev/บอทพี่");
  const memPath = path.resolve(opts.memFile || "/storage/emulated/0/Dev/ai_girl_bot/memory.json");
  const targetCount = Number(opts.targetCount || 20);

  const existsDir = fs.existsSync(targetBroDir);
  const allFiles = existsDir ? fs.readdirSync(targetBroDir).sort() : [];
  const jsModules = allFiles.filter((f) => f.endsWith(".js"));
  const missingCount = Math.max(0, targetCount - jsModules.length);
  const memExists = fs.existsSync(memPath);
  const memBytes = memExists ? fs.statSync(memPath).size : 0;

  return {
    controller: "BOT_NONG_DEBIAN_ROOT",
    monitoredTarget: "BOT_BROTHER_15001",
    broDir: targetBroDir,
    existsDir,
    totalFiles: allFiles.length,
    currentJsModules: jsModules.length,
    targetModules: targetCount,
    missingTo20: missingCount,
    completed20: jsModules.length >= targetCount,
    canonicalMemory: { path: memPath, exists: memExists, bytes: memBytes },
    untouchedPorts: [18080, 18081],
    allowGitPush: false
  };
}

module.exports = { superviseBrotherTo20 };
