const fs = require("fs");
const path = require("path");

function checkMemoryGrowth(memFile = "/storage/emulated/0/Dev/ai_girl_bot/memory.json", maxBytes = 20 * 1024 * 1024) {
  const target = path.resolve(memFile);
  if (!fs.existsSync(target)) return { ok: false, reason: "missing_file", path: target };
  const bytes = fs.statSync(target).size;
  const withinLimit = bytes < maxBytes;
  return {
    ok: withinLimit,
    path: target,
    bytes,
    maxBytes,
    ratioPct: Number(((bytes / maxBytes) * 100).toFixed(2))
  };
}
module.exports = { checkMemoryGrowth };
