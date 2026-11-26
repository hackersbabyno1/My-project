// โมดูลบันทึกชีพจรและเหตุการณ์ของบอทน้อง (ต่อท้ายอย่างเดียว ไม่ลบ ไม่แตะ 18080/18081)
const fs = require('fs');
const path = require('path');

function createNongPulseLogger(logFilePath = '/tmp/nong_bot_session/nong_pulse.jsonl', ownerBot = 'BOT_NONG_DEBIAN_ROOT') {
  const safePath = path.resolve(logFilePath);
  fs.mkdirSync(path.dirname(safePath), { recursive: true });

  function recordPulse(eventType, detail = {}) {
    const entry = {
      ts: new Date().toISOString(),
      ownerBot,
      eventType: String(eventType || 'pulse').trim(),
      detail
    };
    fs.appendFileSync(safePath, JSON.stringify(entry) + '\n', 'utf8');
    return entry;
  }

  function readRecent(limit = 5) {
    if (!fs.existsSync(safePath)) return [];
    const lines = fs.readFileSync(safePath, 'utf8').trim().split('\n').filter(Boolean);
    return lines.slice(-Math.max(1, Number(limit) || 5)).map(l => JSON.parse(l));
  }

  return { logFile: safePath, recordPulse, readRecent };
}

module.exports = { createNongPulseLogger };
