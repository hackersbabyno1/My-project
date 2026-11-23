// โมดูลกันการเขียนทับพร้อมกัน (กันเฉพาะจังหวะที่กำลังเขียนซ้อนกัน ไม่ล็อกขวางการเขียนทั่วไป)
const path = require('path');

function createNongMemoryLock() {
  const inflight = new Map();

  function beginWrite(targetKey, writer = 'unknown', now = Date.now()) {
    const key = path.resolve(String(targetKey || ''));
    if (!key) return { allowed: false, reason: 'empty_target' };

    const active = inflight.get(key);
    if (active) {
      return {
        allowed: false,
        reason: 'CONCURRENT_OVERWRITE_BLOCKED',
        target: key,
        activeWriter: active.writer,
        requestedBy: writer,
        overlapMs: Math.max(0, now - active.startedAt)
      };
    }

    inflight.set(key, { writer, startedAt: now });
    return { allowed: true, reason: 'WRITE_ALLOWED', target: key, writer };
  }

  function endWrite(targetKey, writer = 'unknown') {
    const key = path.resolve(String(targetKey || ''));
    const active = inflight.get(key);
    if (!active) return { ok: true, released: false, target: key };
    if (active.writer === writer || writer === 'force_release') {
      inflight.delete(key);
      return { ok: true, released: true, target: key };
    }
    return { ok: false, released: false, reason: 'WRITER_MISMATCH', activeWriter: active.writer };
  }

  function activeTargets() {
    return Array.from(inflight.entries()).map(([target, info]) => ({
      target,
      writer: info.writer,
      startedAt: info.startedAt
    }));
  }

  return { beginWrite, endWrite, activeTargets };
}

module.exports = { createNongMemoryLock };
