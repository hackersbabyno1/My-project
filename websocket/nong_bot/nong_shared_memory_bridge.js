// โมดูลตัวเชื่อมอ่าน-เขียนความจำร่วมฝั่งบอทน้อง (ใช้กันซ้อน + กันชนเสี้ยววินาที ไม่ล็อกตาย ไม่แตะ 18080/18081)
const fs = require('fs');
const path = require('path');
const { createNongMemoryLock } = require(path.join(__dirname, 'nong_memory_lock.js'));
const { createNongRaceGuard } = require(path.join(__dirname, 'nong_race_guard.js'));

function createSharedMemoryBridge(options = {}) {
  const cooldownMs = Math.max(50, Number(options.cooldownMs) || 300);
  const memLock = createNongMemoryLock();
  const raceGuard = createNongRaceGuard(cooldownMs);

  function readJsonSafe(filePath, fallback = null) {
    const resolved = path.resolve(String(filePath || ''));
    if (!resolved || !fs.existsSync(resolved)) {
      return { ok: true, exists: false, data: fallback, path: resolved };
    }
    const raw = fs.readFileSync(resolved, 'utf8');
    return { ok: true, exists: true, data: JSON.parse(raw), path: resolved };
  }

  function writeJsonGuarded(filePath, payload, actor = 'nong', now = Date.now()) {
    const resolved = path.resolve(String(filePath || ''));
    if (!resolved) return { ok: false, reason: 'empty_path' };

    const raceCheck = raceGuard.acquireSlot(resolved, actor, now);
    if (!raceCheck.allowed) {
      return { ok: false, stage: 'race_guard', detail: raceCheck };
    }

    const writeCheck = memLock.beginWrite(resolved, actor, now);
    if (!writeCheck.allowed) {
      raceGuard.releaseSlot(resolved, actor, now);
      return { ok: false, stage: 'memory_lock', detail: writeCheck };
    }

    try {
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      const serialized = JSON.stringify(payload, null, 2) + '\n';
      fs.writeFileSync(resolved, serialized, 'utf8');
      return { ok: true, path: resolved, actor, writtenAt: new Date(now).toISOString() };
    } finally {
      memLock.endWrite(resolved, actor);
      raceGuard.releaseSlot(resolved, actor, now);
    }
  }

  return { readJsonSafe, writeJsonGuarded };
}

module.exports = { createSharedMemoryBridge };
