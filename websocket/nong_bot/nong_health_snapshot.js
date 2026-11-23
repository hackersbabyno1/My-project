// โมดูลสรุปสุขภาพเซสชันบอทน้องแบบอ่านอย่างเดียว (ไม่แตะ 18080/18081 ไม่ลบ ไม่ Push)
const path = require('path');
const { readSystemVitals } = require(path.join(__dirname, 'nong_sys_vitals.js'));
const { probePortsReadOnly } = require(path.join(__dirname, 'nong_port_reader.js'));
const { buildSessionSummary } = require(path.join(__dirname, 'nong_session_summary.js'));

async function collectNongHealthSnapshot(sessionDir = '/tmp/nong_bot_session') {
  const vitals = readSystemVitals();
  const ports = await probePortsReadOnly([18080, 18081], '127.0.0.1', 800);
  const summary = buildSessionSummary(sessionDir);

  return {
    capturedAt: new Date().toISOString(),
    ownerBot: 'BOT_NONG_DEBIAN_ROOT',
    readOnly: true,
    vitals,
    ports,
    summary
  };
}

module.exports = { collectNongHealthSnapshot };
