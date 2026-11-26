// โมดูลกันการเขียนทับพร้อมกันในเสี้ยววินาทีระหว่างพี่กับน้อง (ไม่แตะ 18080/18081 ไม่ลบ ไม่ Push)
function createNongRaceGuard(cooldownMs = 500) {
  const safeCooldown = Math.max(50, Number(cooldownMs) || 500);
  const activeLocks = new Map();
  const lastWriteAt = new Map();

  function acquireSlot(resourceKey, actor = 'unknown', now = Date.now()) {
    const key = String(resourceKey || '').trim();
    if (!key) return { allowed: false, reason: 'empty_resource_key' };

    const active = activeLocks.get(key);
    if (active && active.actor !== actor && (now - active.acquiredAt) < safeCooldown * 4) {
      return {
        allowed: false,
        reason: 'RACE_LOCK_HELD_BY_OTHER',
        resourceKey: key,
        holder: active.actor,
        requester: actor
      };
    }

    const prevTs = lastWriteAt.get(key);
    if (typeof prevTs === 'number' && (now - prevTs) < safeCooldown) {
      return {
        allowed: false,
        reason: 'RACE_COOLDOWN_COLLISION',
        resourceKey: key,
        requester: actor,
        elapsedMs: now - prevTs,
        cooldownMs: safeCooldown
      };
    }

    activeLocks.set(key, { actor, acquiredAt: now });
    return { allowed: true, reason: 'SLOT_ACQUIRED', resourceKey: key, actor };
  }

  function releaseSlot(resourceKey, actor = 'unknown', now = Date.now()) {
    const key = String(resourceKey || '').trim();
    const active = activeLocks.get(key);
    if (active && active.actor === actor) {
      activeLocks.delete(key);
    }
    lastWriteAt.set(key, now);
    return { released: true, resourceKey: key, actor, timestamp: now };
  }

  return { cooldownMs: safeCooldown, acquireSlot, releaseSlot };
}

module.exports = { createNongRaceGuard };
