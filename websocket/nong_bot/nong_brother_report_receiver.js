function receiveBrotherReport(payload = {}) {
  return {
    receivedBy: "BOT_NONG_DEBIAN_ROOT",
    from: payload.from || "BOT_BROTHER_15001",
    receivedAt: new Date().toISOString(),
    verdict: payload.verdict || "unknown",
    untouchedPorts: [18080, 18081],
    allowGitPush: false
  };
}
module.exports = { receiveBrotherReport };
