// โมดูลที่ 8: เช็กสถานะพอร์ตแบบอ่านอย่างเดียวของบอทน้อง (ไม่แตะ 18080/18081 ไม่ลบ ไม่ Push)
const net = require('net');

function probeTcpPort(host = '127.0.0.1', port = 18080, timeoutMs = 800) {
  const targetPort = Number(port);
  const safeTimeout = Math.max(100, Number(timeoutMs) || 800);

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (reachable, reason) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({
        host,
        port: targetPort,
        reachable,
        readOnly: true,
        reason,
        checkedAt: new Date().toISOString()
      });
    };

    socket.setTimeout(safeTimeout);
    socket.once('connect', () => finish(true, 'tcp_connect_ok'));
    socket.once('timeout', () => finish(false, 'timeout'));
    socket.once('error', (err) => finish(false, err && err.code ? err.code : 'error'));
    socket.connect(targetPort, host);
  });
}

async function probePortsReadOnly(ports = [18080, 18081], host = '127.0.0.1', timeoutMs = 800) {
  const list = Array.isArray(ports) ? ports : [ports];
  const results = [];
  for (const p of list) {
    results.push(await probeTcpPort(host, p, timeoutMs));
  }
  return results;
}

module.exports = { probeTcpPort, probePortsReadOnly };
