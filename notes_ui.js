(function() {
  try {
    ["admin_era_note_162_35_47_89_e1", "admin_era_note_162_35_47_89_e2", "admin_era_note_162_35_47_89_e3", "admin_era_note_collapsed_162_35_47_89"].forEach(function(k) {
      localStorage.removeItem(k);
    });
  } catch (_) {}

  var NOTES = [], boardOpen = true, composerOpen = false, editingId = null;
  var activeCat = "all", searchQuery = "", expandedNotes = {}, showAllNotes = false;
  var CATS = {
    system:  { label: "🛠️ งานระบบ/โค้ด", color: "#38bdf8", bg: "rgba(56,189,248,0.14)", border: "rgba(56,189,248,0.4)" },
    plan:    { label: "💡 ไอเดีย/แผนงาน", color: "#fbbf24", bg: "rgba(251,191,36,0.14)", border: "rgba(251,191,36,0.4)" },
    account: { label: "🔑 บัญชี/รหัส",    color: "#f472b6", bg: "rgba(244,114,182,0.14)", border: "rgba(244,114,182,0.4)" },
    general: { label: "📋 ทั่วไป",        color: "#4ade80", bg: "rgba(74,222,128,0.14)", border: "rgba(74,222,128,0.4)" }
  };

  function post(u, d) {
    return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d || {}) }).then(function(r) { return r.json(); });
  }
  function esc(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fmtTime(ts) {
    if (!ts) return "";
    var d = new Date(ts), pad = function(n) { return n < 10 ? "0" + n : String(n); };
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function cpText(t, el) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(t).catch(function() { prompt("คัดลอกโน้ต:", t); });
    } else {
      var ta = document.createElement("textarea"); ta.value = t; ta.style.cssText = "position:fixed;top:0;left:0;opacity:0.01;";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (_) { prompt("คัดลอกโน้ต:", t); }
      document.body.removeChild(ta);
    }
    if (el) { var o = el.textContent; el.textContent = "✅ แล้ว"; setTimeout(function() { el.textContent = o; }, 1100); }
  }
  function loadAndDraw() {
    fetch("/api/notes/list").then(function(r) { return r.json(); }).then(function(res) {
      if (res && res.ok) { NOTES = res.notes || []; render(); }
    }).catch(function() {});
  }

  function render() {
    var root = document.getElementById("hbAdminNotesBoard");
    if (!root) {
      root = document.createElement("div");
      root.id = "hbAdminNotesBoard";
      root.style.cssText = "margin-top:12px;margin-bottom:10px;display:flex;flex-direction:column;gap:8px;";
      var grpBoard = document.getElementById("hbDynamicGroupsBoard");
      if (grpBoard && grpBoard.parentNode) {
        grpBoard.parentNode.insertBefore(root, grpBoard.nextSibling);
      } else if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(root, anchor.nextSibling);
      } else {
        document.body.appendChild(root);
      }
    }
    root.innerHTML = "";

    var header = document.createElement("div");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:#171923;border:1px solid #3b82f6;border-radius:8px;padding:10px 12px;";
    header.innerHTML =
      '<b style="color:#93c5fd;font-size:13px;">📝 บริหารจัดการโน้ต (' + NOTES.length + ' รายการ)</b>' +
      '<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">' +
        '<button type="button" id="btnNoteNewToggle" style="background:#2563eb;color:#fff;border:none;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:bold;cursor:pointer;white-space:nowrap;">+ เพิ่มโน้ตใหม่</button>' +
        '<button type="button" id="btnNoteBoardFold" style="background:#27272a;color:#e4e4e7;border:1px solid #3f3f46;padding:5px 9px;border-radius:6px;font-size:11px;font-weight:bold;cursor:pointer;white-space:nowrap;">' + (boardOpen ? '▲ ยุบโน้ต' : '▼ ขยายโน้ต') + '</button>' +
        (NOTES.length ? '<button type="button" id="btnNoteClearAll" style="background:#7f1d1d;color:#fecaca;border:none;padding:5px 8px;border-radius:6px;font-size:11px;font-weight:bold;cursor:pointer;white-space:nowrap;">🧹 ล้างทั้งหมด</button>' : '') +
      '</div>';
    root.appendChild(header);

    header.querySelector("#btnNoteNewToggle").onclick = function() { boardOpen = true; editingId = null; composerOpen = !composerOpen; render(); };
    header.querySelector("#btnNoteBoardFold").onclick = function() { boardOpen = !boardOpen; render(); };
    if (NOTES.length && header.querySelector("#btnNoteClearAll")) {
      header.querySelector("#btnNoteClearAll").onclick = function() {
        if (confirm("⚠️ ยืนยันลบโน้ตทั้งหมด?")) post("/api/notes/clear-all", {}).then(loadAndDraw);
      };
    }
    if (!boardOpen) return;

    if (composerOpen || editingId) {
      var editTarget = editingId ? NOTES.find(function(x) { return x.id === editingId; }) : null;
      var formBox = document.createElement("div");
      formBox.style.cssText = "background:#111827;border:1px solid #3b82f6;border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:8px;";
      formBox.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<b style="color:#60a5fa;font-size:12px;">' + (editTarget ? '✏️ แก้ไขโน้ต' : '✨ สร้างบันทึกโน้ตใหม่') + '</b>' +
          '<label style="display:flex;align-items:center;gap:4px;color:#fbbf24;font-size:11px;cursor:pointer;"><input type="checkbox" id="noteFormPin"' + (editTarget && editTarget.pinned ? ' checked' : '') + '> 📌 ปักหมุด</label>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
          '<input type="text" id="noteFormTitle" placeholder="หัวข้อโน้ต..." value="' + esc(editTarget ? editTarget.title : "") + '" style="flex:1;min-width:150px;background:#1f2937;color:#fff;border:1px solid #374151;border-radius:6px;padding:6px 8px;font-size:12px;">' +
          '<select id="noteFormCat" style="background:#1f2937;color:#fff;border:1px solid #374151;border-radius:6px;padding:6px 8px;font-size:11.5px;">' +
            '<option value="system"' + (editTarget && editTarget.category === "system" ? " selected" : "") + '>🛠️ งานระบบ/โค้ด</option>' +
            '<option value="plan"' + (editTarget && editTarget.category === "plan" ? " selected" : "") + '>💡 ไอเดีย/แผนงาน</option>' +
            '<option value="account"' + (editTarget && editTarget.category === "account" ? " selected" : "") + '>🔑 บัญชี/รหัส</option>' +
            '<option value="general"' + (!editTarget || editTarget.category === "general" ? " selected" : "") + '>📋 ทั่วไป</option>' +
          '</select>' +
        '</div>' +
        '<textarea id="noteFormContent" rows="4" placeholder="พิมพ์รายละเอียดโน้ต คำสั่ง หรือแผนงานได้อิสระ..." style="width:100%;box-sizing:border-box;background:#0f172a;color:#f3f4f6;border:1px solid #374151;border-radius:6px;padding:8px;font-size:12px;line-height:1.45;resize:vertical;">' + esc(editTarget ? editTarget.content : "") + '</textarea>' +
        '<div style="display:flex;justify-content:flex-end;gap:6px;">' +
          '<button type="button" id="btnNoteCancel" style="background:#374151;color:#e5e7eb;border:none;padding:6px 12px;border-radius:6px;font-size:11.5px;font-weight:bold;cursor:pointer;">ยกเลิก</button>' +
          '<button type="button" id="btnNoteSave" style="background:#16a34a;color:#fff;border:none;padding:6px 14px;border-radius:6px;font-size:11.5px;font-weight:bold;cursor:pointer;">💾 บันทึกโน้ต</button>' +
        '</div>';
      root.appendChild(formBox);

      formBox.querySelector("#btnNoteCancel").onclick = function() { composerOpen = false; editingId = null; render(); };
      formBox.querySelector("#btnNoteSave").onclick = function() {
        var title = formBox.querySelector("#noteFormTitle").value;
        var category = formBox.querySelector("#noteFormCat").value;
        var content = formBox.querySelector("#noteFormContent").value;
        var pinned = formBox.querySelector("#noteFormPin").checked;
        if (!title.trim() && !content.trim()) { alert("กรุณากรอกข้อมูลโน้ตก่อนบันทึก"); return; }
        var url = editTarget ? "/api/notes/update" : "/api/notes/create";
        var payload = { title: title, category: category, content: content, pinned: pinned };
        if (editTarget) payload.id = editTarget.id;
        post(url, payload).then(function(r) {
          if (r && r.ok) { composerOpen = false; editingId = null; loadAndDraw(); }
          else alert((r && r.error) || "บันทึกไม่สำเร็จ");
        });
      };
    }

    var filterBar = document.createElement("div");
    filterBar.style.cssText = "background:#18181b;border:1px solid #27272a;border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:6px;";
    var tabsHtml = [
      { id: "all", label: "ทั้งหมด (" + NOTES.length + ")" },
      { id: "pinned", label: "📌 ปักหมุด" },
      { id: "system", label: "🛠️ ระบบ/โค้ด" },
      { id: "plan", label: "💡 แผนงาน" },
      { id: "account", label: "🔑 บัญชี/รหัส" },
      { id: "general", label: "📋 ทั่วไป" }
    ].map(function(t) {
      var act = activeCat === t.id;
      return '<button type="button" data-ncat="' + t.id + '" style="background:' + (act ? '#2563eb' : '#27272a') + ';color:' + (act ? '#fff' : '#a1a1aa') + ';border:none;padding:4px 8px;border-radius:5px;font-size:10.5px;font-weight:bold;cursor:pointer;white-space:nowrap;">' + t.label + '</button>';
    }).join("");

    filterBar.innerHTML =
      '<input type="text" id="noteSearchInp" placeholder="🔍 ค้นหาหัวข้อหรือข้อความในโน้ต..." value="' + esc(searchQuery) + '" style="width:100%;box-sizing:border-box;background:#09090b;color:#fff;border:1px solid #3f3f46;border-radius:6px;padding:6px 8px;font-size:11.5px;">' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;">' + tabsHtml + '</div>';
    root.appendChild(filterBar);

    filterBar.querySelector("#noteSearchInp").oninput = function(e) {
      searchQuery = e.target.value || ""; render();
      var el = document.getElementById("noteSearchInp");
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    };
    filterBar.querySelectorAll("[data-ncat]").forEach(function(b) {
      b.onclick = function() { activeCat = b.getAttribute("data-ncat"); render(); };
    });

    var q = searchQuery.trim().toLowerCase();
    var filtered = NOTES.filter(function(n) {
      if (activeCat === "pinned" && !n.pinned) return false;
      if (activeCat !== "all" && activeCat !== "pinned" && (n.category || "general") !== activeCat) return false;
      if (q && ((n.title || "") + " " + (n.content || "")).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    if (!filtered.length) {
      var empty = document.createElement("div");
      empty.style.cssText = "background:#141417;border:1px dashed #3f3f46;border-radius:8px;padding:14px;text-align:center;color:#71717a;font-size:12px;";
      empty.innerHTML = NOTES.length === 0 ? 'ยังไม่มีบันทึกโน้ต — กด <b style="color:#60a5fa;">+ เพิ่มโน้ตใหม่</b> เพื่อเริ่มจดบันทึกได้เลย' : 'ไม่พบโน้ตที่ค้นหา';
      root.appendChild(empty);
      return;
    }

    var visList = showAllNotes ? filtered : filtered.slice(0, 5);
    var hiddenCount = Math.max(0, filtered.length - 5);

    visList.forEach(function(n) {
      var cInfo = CATS[n.category] || CATS.general;
      var isLong = (n.content || "").length > 180 || (n.content || "").split("\n").length > 4;
      var isExp = !!expandedNotes[n.id];
      var dispContent = (!isLong || isExp) ? (n.content || "") : ((n.content || "").slice(0, 180) + "...");

      var card = document.createElement("div");
      card.style.cssText = "background:#14161f;border:1px solid " + (n.pinned ? "#f59e0b" : "#27272a") + ";border-radius:8px;padding:9px 10px;display:flex;flex-direction:column;gap:6px;";
      card.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">' +
          '<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;flex:1;">' +
            (n.pinned ? '<span style="font-size:12px;">📌</span>' : '') +
            '<b style="color:#f8fafc;font-size:12.5px;">' + esc(n.title) + '</b>' +
            '<span style="background:' + cInfo.bg + ';color:' + cInfo.color + ';border:1px solid ' + cInfo.border + ';padding:1px 6px;border-radius:4px;font-size:10px;font-weight:bold;">' + cInfo.label + '</span>' +
          '</div>' +
          '<span style="color:#71717a;font-size:10px;white-space:nowrap;">' + fmtTime(n.updatedAt || n.createdAt) + '</span>' +
        '</div>' +
        (dispContent ? '<div style="background:rgba(0,0,0,0.35);border-radius:6px;padding:7px 8px;color:#d4d4d8;font-size:11.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word;">' + esc(dispContent) + '</div>' : '') +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:4px;flex-wrap:wrap;">' +
          '<div>' + (isLong ? '<button type="button" class="btn-nmore" style="background:none;border:none;color:#60a5fa;font-size:11px;font-weight:bold;cursor:pointer;padding:2px 0;">' + (isExp ? '▲ ย่อข้อความ' : '▼ อ่านทั้งหมด') + '</button>' : '') + '</div>' +
          '<div style="display:flex;align-items:center;gap:4px;flex-wrap:nowrap;">' +
            '<button type="button" class="btn-npin" style="background:#27272a;color:#fbbf24;border:1px solid #3f3f46;padding:3px 6px;border-radius:4px;font-size:10.5px;cursor:pointer;white-space:nowrap;">' + (n.pinned ? 'เลิกปักหมุด' : '📌 ปักหมุด') + '</button>' +
            '<button type="button" class="btn-ncp" style="background:#1d4ed8;color:#fff;border:none;padding:3px 7px;border-radius:4px;font-size:10.5px;font-weight:bold;cursor:pointer;white-space:nowrap;">คัดลอก</button>' +
            '<button type="button" class="btn-nedit" style="background:#0f766e;color:#fff;border:none;padding:3px 7px;border-radius:4px;font-size:10.5px;font-weight:bold;cursor:pointer;white-space:nowrap;">แก้ไข</button>' +
            '<button type="button" class="btn-ndel" style="background:#dc2626;color:#fff;border:none;padding:3px 7px;border-radius:4px;font-size:10.5px;font-weight:bold;cursor:pointer;white-space:nowrap;">ลบ</button>' +
          '</div>' +
        '</div>';

      if (isLong && card.querySelector(".btn-nmore")) card.querySelector(".btn-nmore").onclick = function() { expandedNotes[n.id] = !isExp; render(); };
      card.querySelector(".btn-npin").onclick = function() { post("/api/notes/pin", { id: n.id }).then(loadAndDraw); };
      card.querySelector(".btn-ncp").onclick = function() { cpText((n.title ? n.title + "\n" : "") + (n.content || ""), this); };
      card.querySelector(".btn-nedit").onclick = function() { composerOpen = false; editingId = n.id; render(); };
      card.querySelector(".btn-ndel").onclick = function() { if (confirm("ยืนยันลบโน้ต \"" + n.title + "\"?")) post("/api/notes/delete", { id: n.id }).then(loadAndDraw); };
      root.appendChild(card);
    });

    if (hiddenCount > 0) {
      var moreBtn = document.createElement("button");
      moreBtn.type = "button";
      moreBtn.style.cssText = "width:100%;background:#27272a;color:#93c5fd;border:1px solid #3f3f46;border-radius:6px;padding:6px 8px;font-size:11.5px;font-weight:bold;cursor:pointer;";
      moreBtn.textContent = showAllNotes ? "▲ ยุบเก็บ (แสดง 5 โน้ตล่าสุด)" : ("▼ ขยายดูโน้ตเพิ่มอีก " + hiddenCount + " รายการ (ทั้งหมด " + filtered.length + " โน้ต)");
      moreBtn.onclick = function() { showAllNotes = !showAllNotes; render(); };
      root.appendChild(moreBtn);
    }
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", loadAndDraw) : loadAndDraw();
})();
