const fs = require("fs");
const path = require("path");
const DEFAULT_MEM = "/storage/emulated/0/Dev/ai_girl_bot/memory.json";

function getNongMemoryStatus(memPath = DEFAULT_MEM) {
  const target = path.resolve(memPath);
  if (!fs.existsSync(target)) return { ok: false, reason: "missing_memory", path: target };
  const st = fs.statSync(target);
  return {
    ok: true,
    path: target,
    bytes: st.size,
    untouchedPorts: [18080, 18081]
  };
}
module.exports = { getNongMemoryStatus };
