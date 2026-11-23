// โมดูลเช็กสถานะระบบและหน่วยความจำฝั่งบอทน้อง (อ่านอย่างเดียว ไม่แตะ 18080/18081 ไม่ลบ ไม่ Push)
const os = require('os');

function readSystemVitals() {
  const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
  const freeMemMb = Math.round(os.freemem() / (1024 * 1024));
  const usedMemMb = Math.max(0, totalMemMb - freeMemMb);
  const usedMemPct = totalMemMb > 0 ? Number(((usedMemMb / totalMemMb) * 100).toFixed(1)) : 0;

  return {
    checkedAt: new Date().toISOString(),
    hostname: os.hostname(),
    platform: `${os.platform()}/${os.arch()}`,
    uptimeSec: Math.floor(os.uptime()),
    loadAvg: os.loadavg().map(n => Number(n.toFixed(2))),
    memoryMb: {
      total: totalMemMb,
      free: freeMemMb,
      used: usedMemMb,
      usedPct: usedMemPct
    }
  };
}

module.exports = { readSystemVitals };
