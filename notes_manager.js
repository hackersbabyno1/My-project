const fs = require("fs");
const path = require("path");
const NOTES_FILE = path.join(__dirname, "admin_notes.json");
const NOTES_UI_FILE = path.join(__dirname, "notes_ui.js");

function loadNotes() {
  try {
    if (!fs.existsSync(NOTES_FILE)) return [];
    const d = JSON.parse(fs.readFileSync(NOTES_FILE, "utf8"));
    return Array.isArray(d) ? d : [];
  } catch (e) { return []; }
}
function saveNotes(list) {
  const tmp = path.join(__dirname, `.admin_notes_${process.pid}_${Date.now()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), "utf8");
  fs.renameSync(tmp, NOTES_FILE);
}
function readBody(req, cb) {
  let b = "";
  req.on("data", c => b += c);
  req.on("end", () => { try { cb(JSON.parse(b || "{}")); } catch (e) { cb({}); } });
}
function jsonRes(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

module.exports = function handleNotes(req, res, pathname, isAdmin) {
  if (pathname === "/notes-ui.js") {
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(fs.existsSync(NOTES_UI_FILE) ? fs.readFileSync(NOTES_UI_FILE, "utf8") : "");
  }
  if (!pathname.startsWith("/api/notes")) return false;
  if (!isAdmin) { jsonRes(res, 401, { ok: false, error: "Unauthorized" }); return true; }

  if (pathname === "/api/notes/list") {
    const notes = loadNotes().sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
    });
    jsonRes(res, 200, { ok: true, notes });
    return true;
  }
  if (pathname === "/api/notes/create" && req.method === "POST") {
    readBody(req, d => {
      const title = String(d.title || "").trim() || "โน้ตไม่มีหัวข้อ";
      const content = String(d.content || "").trim();
      const category = String(d.category || "general").trim() || "general";
      const pinned = !!d.pinned;
      if (!content && !String(d.title || "").trim()) return jsonRes(res, 400, { ok: false, error: "กรุณากรอกข้อมูลโน้ต" });
      const notes = loadNotes();
      const now = Date.now();
      const note = { id: "note_" + now + "_" + Math.floor(Math.random() * 1000), title, content, category, pinned, createdAt: now, updatedAt: now };
      notes.unshift(note);
      saveNotes(notes);
      jsonRes(res, 200, { ok: true, note });
    });
    return true;
  }
  if (pathname === "/api/notes/update" && req.method === "POST") {
    readBody(req, d => {
      const id = String(d.id || "").trim();
      const notes = loadNotes();
      const idx = notes.findIndex(n => n.id === id);
      if (idx === -1) return jsonRes(res, 404, { ok: false, error: "ไม่พบโน้ต" });
      if (d.title !== undefined) notes[idx].title = String(d.title || "").trim() || "โน้ตไม่มีหัวข้อ";
      if (d.content !== undefined) notes[idx].content = String(d.content || "").trim();
      if (d.category !== undefined) notes[idx].category = String(d.category || "general").trim() || "general";
      if (d.pinned !== undefined) notes[idx].pinned = !!d.pinned;
      notes[idx].updatedAt = Date.now();
      saveNotes(notes);
      jsonRes(res, 200, { ok: true, note: notes[idx] });
    });
    return true;
  }
  if (pathname === "/api/notes/pin" && req.method === "POST") {
    readBody(req, d => {
      const id = String(d.id || "").trim();
      const notes = loadNotes();
      const idx = notes.findIndex(n => n.id === id);
      if (idx === -1) return jsonRes(res, 404, { ok: false, error: "ไม่พบโน้ต" });
      notes[idx].pinned = !notes[idx].pinned;
      notes[idx].updatedAt = Date.now();
      saveNotes(notes);
      jsonRes(res, 200, { ok: true, pinned: notes[idx].pinned });
    });
    return true;
  }
  if (pathname === "/api/notes/delete" && req.method === "POST") {
    readBody(req, d => {
      const id = String(d.id || "").trim();
      saveNotes(loadNotes().filter(n => n.id !== id));
      jsonRes(res, 200, { ok: true });
    });
    return true;
  }
  if (pathname === "/api/notes/clear-all" && req.method === "POST") {
    saveNotes([]);
    jsonRes(res, 200, { ok: true });
    return true;
  }
  return false;
};
