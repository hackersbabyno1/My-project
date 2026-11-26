const fs = require("fs");
const path = require("path");

function checkNongSeedPair(dir = "/storage/emulated/0/Dev/บอทน้อง") {
  const seedFile = path.join(dir, "nong_seed.json");
  const pulledFile = path.join(dir, "nong_seed_pulled_to_admin.json");
  const hasSeed = fs.existsSync(seedFile);
  const hasPulled = fs.existsSync(pulledFile);
  return {
    ok: hasSeed && hasPulled,
    hasSeed,
    hasPulled,
    dir
  };
}
module.exports = { checkNongSeedPair };
