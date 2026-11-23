function buildBrotherDispatch(inspection = {}, memoryInfo = {}, seedInfo = {}) {
  const issueText = Array.isArray(inspection.issues) && inspection.issues.length
    ? inspection.issues.join(", ")
    : "none";
  return {
    from: "บอทพี่",
    to: inspection.nongBotId || "บอทน้อง",
    supervisedBy: "BOT_NONG_DEBIAN_ROOT",
    verdict: inspection.verdict || "unknown",
    untouchedPorts: [18080, 18081],
    seedOk: Boolean(seedInfo.ok),
    memoryBytes: memoryInfo.bytes || 0,
    message: `[น้องคุม->พี่] สถานะตรวจ: ${inspection.verdict || "unknown"} | จุดที่ต้องดู: ${issueText} | เมล็ดพันธุ์: ${seedInfo.ok ? "OK" : "CHECK"} | ความจำหลัก: ${memoryInfo.bytes || 0}B | ไม่แตะ 18080/18081`
  };
}
module.exports = { buildBrotherDispatch };
