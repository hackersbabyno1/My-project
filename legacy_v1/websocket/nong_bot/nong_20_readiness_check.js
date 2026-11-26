const fs = require("fs");
const path = require("path");

function checkNong20Readiness(dir = "/storage/emulated/0/Dev/บอทน้อง") {
  const target = path.resolve(dir);
  const jsFiles = fs.existsSync(target)
    ? fs.readdirSync(target).filter((f) => f.endsWith(".js")).sort()
    : [];
  return {
    ok: jsFiles.length >= 20,
    jsCount: jsFiles.length,
    targetModules: 20,
    missingTo20: Math.max(0, 20 - jsFiles.length),
    untouchedPorts: [18080, 18081],
    allowGitPush: false
  };
}
module.exports = { checkNong20Readiness };
