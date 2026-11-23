// โมดูลสรุปเหตุการณ์ย้อนหลังของบอทน้อง (อ่านอย่างเดียว ไม่ลบ ไม่แตะ 18080/18081)
const fs = require('fs');
const path = require('path');

function digestPulseLog(pulseFilePath = '/tmp/nong_bot_session/nong_pulse.jsonl', limit = 10) {
  const resolved = path.resolve(String(pulseFilePath || ''));
  const maxItems = Math.max(1, Math.min(200, Number(limit) || 10));

  if (!resolved || !fs.existsSync(resolved)) {
    return {
      ok: true,
      exists: false,
      path: resolved,
      totalLines: 0,
      recentEvents: []
    };
  }

  const rawLines = fs.readFileSync(resolved, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const parsed = rawLines.slice(-maxItems).map((line, idx) => {
    try {
      return { index: rawLines.length - Math.min(rawLines.length, maxItems) + idx, rawValidJson: true, event: JSON.parse(line) };
    } catch (_) {
      return { index: rawLines.length - Math.min(rawLines.length, maxItems) + idx, rawValidJson: false, raw: line };
    }
  });

  return {
    ok: true,
    exists: true,
    path: resolved,
    totalLines: rawLines.length,
    returnedCount: parsed.length,
    recentEvents: parsed
  };
}

module.exports = { digestPulseLog };
