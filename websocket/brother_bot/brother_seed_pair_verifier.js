const fs = require("fs");
const path = require("path");

function verifySeedPair(dir = "/storage/emulated/0/Dev/บอทพี่") {
  const seedP = path.join(dir, "brother_seed.json");
  const adminP = path.join(dir, "admin_brother_canonical_seed.json");
  const hasSeed = fs.existsSync(seedP);
  const hasAdmin = fs.existsSync(adminP);
  if (!hasSeed || !hasAdmin) {
    return { ok: false, hasSeed, hasAdmin, reason: "missing_seed_pair" };
  }
  const seedData = JSON.parse(fs.readFileSync(seedP, "utf8"));
  const adminData = JSON.parse(fs.readFileSync(adminP, "utf8"));
  const sameAuth = seedData.seedAuthority === adminData.seedAuthority;
  const bothNonCopy = seedData.isCopy === false && adminData.isCopy === false;
  return {
    ok: sameAuth && bothNonCopy,
    hasSeed,
    hasAdmin,
    sameAuth,
    bothNonCopy,
    seedAuthority: seedData.seedAuthority || null
  };
}
module.exports = { verifySeedPair };
