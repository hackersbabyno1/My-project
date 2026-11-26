function inspectNongReport(report = {}, extra = {}) {
  const issues = [];
  const ports = report.ports || {};
  if (!report.targetValid) issues.push("target_not_valid");
  if (extra.existsServer === false) issues.push("missing_server_js");
  if (report.backendOk === false) issues.push("backend_closed_" + (ports.backend || 18081));
  if (report.frontendOk === false) issues.push("frontend_closed_" + (ports.frontend || 18080));
  return {
    checkedBy: "brother",
    supervisedBy: "BOT_NONG_DEBIAN_ROOT",
    checkedAt: new Date().toISOString(),
    nongBotId: report.botId || "UNKNOWN_NONG",
    vpsHost: report.vpsHost || null,
    untouchedPorts: [18080, 18081],
    verdict: issues.length === 0 ? "ready" : "needs_attention",
    issues
  };
}
module.exports = { inspectNongReport };
