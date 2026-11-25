(function() {
  var G = [], K = [], H = location.hostname || "162.35.47.89";
  var openMap = {};
  function post(u, d) {
    return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d || {}) }).then(function(r) { return r.json(); });
  }
  function dd() { return document.getElementById("keyStepDropdown"); }
  function btn() { return document.getElementById("btnKeyStepMain"); }

  window.promptCreateCustomGroup = function() {
    if (dd()) dd().style.setProperty("display", "none", "important");
    var n = prompt("ตั้งชื่อกลุ่มใหม่ (เช่น ลูกค้ากลุ่ม 1 / เทสต์กลุ่ม 2):", "");
    if (!n || !n.trim()) return;
    var d = prompt("จำนวนวันเริ่มต้นของกลุ่ม \"" + n.trim() + "\":", "7");
    if (d === null) return;
    post("/api/dynamic-group/create", { name: n.trim(), defaultDays: Math.max(1, parseInt(d, 10) || 7) }).then(function(r) {
      if (r && r.ok) { if (r.group && r.group.id) openMap[String(r.group.id)] = true; draw(); }
      else alert(r.error || "สร้างกลุ่มไม่สำเร็จ");
    });
  };

  window.promptCreateCustomUser = function(gid, gname, ddays) {
    if (dd()) dd().style.setProperty("display", "none", "important");
    if (!gid) {
      if (!G.length) { alert("ยังไม่มีกลุ่ม กรุณากดสร้างกลุ่มใหม่ก่อนครับ"); return window.promptCreateCustomGroup(); }
      var p = prompt("เลือกหมายเลขกลุ่ม:\n" + G.map(function(g, i) { return (i + 1) + ". " + g.name; }).join("\n"), "1");
      if (p === null) return;
      var c = G[(parseInt(p, 10) || 1) - 1] || G[0];
      gid = c.id; gname = c.name; ddays = c.defaultDays;
    }
    var un = prompt("ตั้งชื่อยูสเซอร์ใน \"" + gname + "\":", gname + "-" + (K.filter(function(k) { return k.group === gid; }).length + 1));
    if (un === null) return;
    var ud = prompt("จำนวนวันใช้งาน:", String(ddays || 7));
    if (ud === null) return;
    post("/api/dynamic-key/create", { groupId: gid, name: un.trim() || (gname + "-User"), days: Math.max(1, parseInt(ud, 10) || ddays || 7) }).then(function(r) {
      if (r && r.ok) { openMap[String(gid)] = true; draw(); }
      else alert(r.error || "สร้างคีย์ไม่สำเร็จ");
    });
  };

  window.delGrp = function(id, nm) {
    if (confirm("ยืนยันลบกลุ่ม \"" + nm + "\" และคีย์ทั้งหมดในกลุ่ม?")) post("/api/dynamic-group/delete", { groupId: id }).then(draw);
  };
  window.delUsr = function(id, nm) {
    if (confirm("ยืนยันลบยูสเซอร์ #" + id + " (" + nm + ")?")) post("/api/dynamic-key/delete", { id: id }).then(draw);
  };
  window.toggleAllCustomGroups = function() {
    var nextState = !G.some(function(g) { return !!openMap[String(g.id)]; });
    G.forEach(function(g) { openMap[String(g.id)] = nextState; });
    draw();
  };
  window.toggleKeyStepMenu = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    var m = dd(), b = btn();
    if (!m) return;
    m.innerHTML =
      '<div style="padding:4px 8px;border-bottom:1px solid #333;color:#9ca3af;font-size:11px;">จัดการกลุ่ม & ยูสเซอร์อิสระ</div>' +
      '<button type="button" onclick="promptCreateCustomGroup()" style="display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid #333;padding:10px;color:#4ade80;font-weight:bold;font-size:13px;cursor:pointer;">📁 + สร้างกลุ่มใหม่เอง</button>' +
      '<button type="button" onclick="promptCreateCustomUser()" style="display:block;width:100%;text-align:left;background:none;border:none;padding:10px;color:#38bdf8;font-weight:bold;font-size:13px;cursor:pointer;">👤 + สร้างคีย์ / ยูสเซอร์</button>';
    if (getComputedStyle(m).display !== "none") { m.style.setProperty("display", "none", "important"); return; }
    m.style.setProperty("display", "block", "important");
    m.style.setProperty("position", "fixed", "important");
    m.style.setProperty("z-index", "2147483647", "important");
    if (b) {
      var r = b.getBoundingClientRect();
      m.style.setProperty("left", Math.max(8, Math.min(r.left, window.innerWidth - 235)) + "px", "important");
      m.style.setProperty("top", (r.bottom + 6) + "px", "important");
    }
  };

  function cp(t, el) {
    if (navigator.clipboard) navigator.clipboard.writeText(t); else prompt("คัดลอกลิงก์:", t);
    if (el) { var o = el.textContent; el.textContent = "คัดลอกแล้ว ✓"; setTimeout(function() { el.textContent = o; }, 1000); }
  }

  function draw() {
    var w = document.getElementById("hbDynamicGroupsBoard");
    if (!w) { w = document.createElement("div"); w.id = "hbDynamicGroupsBoard"; w.style.cssText = "margin-top:16px;display:flex;flex-direction:column;gap:8px;"; document.body.appendChild(w); }
    fetch("/api/dynamic-data").then(function(r) { return r.json(); }).then(function(res) {
      if (!res || !res.ok) return;
      G = res.groups || []; K = res.keys || []; H = res.host || H; w.innerHTML = "";
      var anyOpen = G.some(function(g) { return !!openMap[String(g.id)]; });
      var top = document.createElement("div");
      top.style.cssText = "display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:#18181b;border:1px solid #3f3f46;border-radius:8px;padding:10px 12px;";
      top.innerHTML = '<b style="color:#fff;font-size:13px;">📂 กลุ่มของแอดมิน (' + G.length + ' กลุ่ม | ' + K.length + ' คีย์)</b><div style="display:flex;gap:6px;">' + (G.length ? '<button type="button" onclick="toggleAllCustomGroups()" style="background:#3f3f46;color:#e4e4e7;border:none;padding:6px 10px;border-radius:6px;font-size:12px;font-weight:bold;cursor:pointer;">' + (anyOpen ? '▲ ยุบทั้งหมด' : '▼ กางทั้งหมด') + '</button>' : '') + '<button type="button" onclick="promptCreateCustomGroup()" style="background:#16a34a;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:bold;cursor:pointer;">📁 + สร้างกลุ่มใหม่</button></div>';
      w.appendChild(top);

      G.forEach(function(g) {
        var gid = String(g.id), isOpen = !!openMap[gid], list = K.filter(function(k) { return String(k.group) === gid; });
        var c = document.createElement("div"); c.style.cssText = "background:#18181b;border:1px solid #333;border-radius:8px;overflow:hidden;";
        var hd = document.createElement("div"); hd.style.cssText = "padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;background:#27272a;cursor:pointer;";
        hd.innerHTML = '<div style="display:flex;align-items:center;gap:6px;flex:1;"><span style="color:#a1a1aa;font-size:11px;">' + (isOpen ? '▼' : '▶') + '</span><span style="color:#fff;font-weight:bold;font-size:13px;">' + g.name + ' (' + list.length + ')</span><small style="color:#a1a1aa;">· ' + (g.defaultDays || 7) + ' วัน</small></div><div style="display:flex;gap:6px;"><button type="button" class="au" style="background:#2563eb;color:#fff;border:none;padding:5px 9px;border-radius:5px;font-size:11px;font-weight:bold;cursor:pointer;">+ ยูสเซอร์</button><button type="button" class="dg" style="background:#7f1d1d;color:#fecaca;border:none;padding:5px 8px;border-radius:5px;font-size:11px;cursor:pointer;">ลบกลุ่ม</button></div>';
        hd.onclick = function(ev) { if (!ev.target.closest("button")) { openMap[gid] = !isOpen; draw(); } };
        hd.querySelector(".au").onclick = function(ev) { ev.stopPropagation(); promptCreateCustomUser(g.id, g.name, g.defaultDays); };
        hd.querySelector(".dg").onclick = function(ev) { ev.stopPropagation(); delGrp(g.id, g.name); };
        c.appendChild(hd);

        if (isOpen) {
          var bd = document.createElement("div"); bd.style.cssText = "padding:8px 12px;display:flex;flex-direction:column;gap:6px;background:#141417;";
          if (!list.length) bd.innerHTML = '<small style="color:#71717a;">ยังไม่มีคีย์ในกลุ่มนี้</small>';
          list.forEach(function(k) {
            var vl = "vless://" + k.uuid + "@" + H + ":443?type=ws&path=%2Fvless&security=tls&encryption=none&host=" + H + "#" + encodeURIComponent(k.name || "User");
            var vm = "vmess://" + btoa(unescape(encodeURIComponent(JSON.stringify({ v: "2", ps: (k.name || "User") + "-VMess", add: H, port: "444", id: k.uuid, aid: "0", scy: "auto", net: "ws", type: "none", host: H, path: "/vmess", tls: "" }))));
            var rw = document.createElement("div"); rw.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;padding:5px 0;border-bottom:1px solid #27272a;";
            rw.innerHTML = '<span style="font-size:12px;color:#e4e4e7;"><b>#' + k.id + ' ' + (k.name || '') + '</b> (' + (k.durationDays || 7) + ' วัน)</span><div style="display:flex;gap:4px;"><button type="button" class="cvl" style="background:#15803d;color:#fff;border:none;padding:4px 7px;border-radius:4px;font-size:11px;cursor:pointer;">VLESS</button><button type="button" class="cvm" style="background:#0369a1;color:#fff;border:none;padding:4px 7px;border-radius:4px;font-size:11px;cursor:pointer;">VMess</button><button type="button" class="du" style="background:#b91c1c;color:#fff;border:none;padding:4px 7px;border-radius:4px;font-size:11px;cursor:pointer;">ลบ</button></div>';
            rw.querySelector(".cvl").onclick = function() { cp(vl, this); };
            rw.querySelector(".cvm").onclick = function() { cp(vm, this); };
            rw.querySelector(".du").onclick = function() { delUsr(k.id, k.name || ""); };
            bd.appendChild(rw);
          });
          c.appendChild(bd);
        }
        w.appendChild(c);
      });
    });
  }

  function bindBtnDirect() { var b = btn(); if (b && !b.dataset.dynBound) { b.dataset.dynBound = "1"; b.onclick = window.toggleKeyStepMenu; b.addEventListener("click", window.toggleKeyStepMenu, true); } }
  bindBtnDirect(); setTimeout(bindBtnDirect, 300);
  document.addEventListener("click", function(e) { var m = dd(), b = btn(); if (m && getComputedStyle(m).display !== "none" && (!b || !b.contains(e.target)) && !m.contains(e.target)) m.style.setProperty("display", "none", "important"); });
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", draw) : draw();
})();
