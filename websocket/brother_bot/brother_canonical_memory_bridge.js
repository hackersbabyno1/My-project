const fs = require("fs");
const path = require("path");
const DEFAULT_MEM = "/storage/emulated/0/Dev/ai_girl_bot/memory.json";

function readCanonicalMemory(memFile = DEFAULT_MEM) {
  const target = path.resolve(memFile);
  if (!fs.existsSync(target)) return { ok: false, reason: "missing_memory_file", path: target };
  const raw = fs.readFileSync(target, "utf8");
  const st = fs.statSync(target);
  const data = JSON.parse(raw);
  const topKeys = Array.isArray(data) ? ["__array__"] : Object.keys(data || {});
  return { ok: true, path: target, bytes: st.size, topKeys, data };
}

function appendCanonicalMemory(entry, opts = {}) {
  const target = path.resolve(opts.memFile || DEFAULT_MEM);
  const res = readCanonicalMemory(target);
  if (!res.ok) return res;
  const maxBytes = Number(opts.maxBytes || 20 * 1024 * 1024);
  if (res.bytes >= maxBytes) return { ok: false, reason: "memory_size_limit", bytes: res.bytes };

  const dedupKey = opts.dedupKey || "id";
  const bucketKey = opts.bucketKey || "brother_logs";
  const payload = typeof entry === "object" && entry !== null ? entry : { note: String(entry) };
  const item = { at: new Date().toISOString(), ...payload };

  if (Array.isArray(res.data)) {
    const exists = item[dedupKey] && res.data.some((x) => x && x[dedupKey] === item[dedupKey]);
    if (exists) return { ok: true, appended: false, reason: "duplicate_entry" };
    res.data.push(item);
  } else {
    if (!Array.isArray(res.data[bucketKey])) res.data[bucketKey] = [];
    const exists = item[dedupKey] && res.data[bucketKey].some((x) => x && x[dedupKey] === item[dedupKey]);
    if (exists) return { ok: true, appended: false, reason: "duplicate_entry" };
    res.data[bucketKey].push(item);
  }

  fs.writeFileSync(target, JSON.stringify(res.data, null, 2) + "\n", "utf8");
  return { ok: true, appended: true, path: target, bucketKey };
}

module.exports = { readCanonicalMemory, appendCanonicalMemory };
