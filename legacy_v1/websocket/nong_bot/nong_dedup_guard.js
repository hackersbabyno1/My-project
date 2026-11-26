// โมดูลกันคำสั่งซ้ำของตัวบอทในเซสชันใหม่ (ไม่แตะพอร์ต 18080/18081 ไม่ลบ ไม่ Push)
function createNongDedupGuard(windowMs = 3000) {
  const safeWindow = Math.max(100, Number(windowMs) || 3000);
  const lastSeen = new Map();

  function shouldAllow(key, now = Date.now()) {
    const k = String(key || '').trim();
    if (!k) return true;
    const prev = lastSeen.get(k);
    if (typeof prev === 'number' && (now - prev) < safeWindow) {
      return false;
    }
    lastSeen.set(k, now);
    return true;
  }

  return { windowMs: safeWindow, shouldAllow };
}

module.exports = { createNongDedupGuard };
