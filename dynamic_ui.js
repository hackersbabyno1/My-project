(function() {
  var K = [], NOW = Date.now(), H = location.hostname || "162.35.47.89";
  var openMap = { admin_free: false, family: false, test: false, general: false };
  var expMap = {};
  var PROTOS = ["VLESS","VMess","Trojan","Shadowsocks","Hysteria2","TUIC","SSH","WireGuard","OpenVPN","SOCKS5"];

  var ZONES = [
    {
      id: "admin_free",
      icon: "👑",
      title: "โซนแอดมินอิสระ",
      subtitle: "ไม่จำกัดสิทธิ์ · ครบ 10 โปรโตคอล · ปรับเวลา/ไม่จำกัดได้อิสระ",
      accent: "#f59e0b",
      border: "#78350f",
      bg: "#1c1917",
      allowHours: true,
      allowUnlimited: true,
      defaultUnit: "unlimited",
      defaultAmount: 0
    },
    {
      id: "family",
      icon: "👨‍👩‍👧",
      title: "กลุ่มครอบครัว",
      subtitle: "ใช้งานฟรี · เพิ่ม/ลบคีย์และปรับเวลาได้อิสระ",
      accent: "#38bdf8",
      border: "#0c4a6e",
      bg: "#0f172a",
      allowHours: false,
      allowUnlimited: true,
      defaultUnit: "days",
      defaultAmount: 30
    },
    {
      id: "test",
      icon: "🧪",
      title: "กลุ่มเทสต์ (ผู้ร่วมทดสอบ)",
      subtitle: "แจกฟรีผู้ร่วมทดสอบ · ปรับเวลาเป็น ชั่วโมง (ชม.) หรือ วัน",
      accent: "#f472b6",
      border: "#831843",
      bg: "#1f121b",
      allowHours: true,
      allowUnlimited: false,
      defaultUnit: "hours",
      defaultAmount: 6
    },
    {
      id: "general",
      icon: "💳",
      title: "กลุ่มทั่วไป (ลูกค้าจ่ายเงินแล้ว)",
      subtitle: "ใช้งานจริงแบบชำระเงินแล้ว · แยกจากกลุ่มเทสต์และแอดมิน",
      accent: "#4ade80",
      border: "#14532d",
      bg: "#0c1f14",
      allowHours: false,
      allowUnlimited: false,
      defaultUnit: "days",
      defaultAmount: 30
    }
  ];

  function post(u, d) {
    return fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d || {}) }).then(function(r) { return r.json(); });
  }
  function dd() { return document.getElementById("keyStepDropdown"); }
  function btn() { return document.getElementById("btnKeyStepMain"); }

  function detectProto(k) {
    if (k.proto) return k.proto;
    var m = String(k.name || "").match(/^\[([^\]]+)\]/);
    return m ? m[1] : "VLESS";
  }

  function buildLink(k) {
    var pr = detectProto(k);
    var nm = encodeURIComponent(k.name || ("Key-" + k.id));
    var u = k.uuid || "";
    if (pr === "VMess") {
      return "vmess://" + btoa(unescape(encodeURIComponent(JSON.stringify({
        v: "2", ps: (k.name || "User") + "-VMess", add: H, port: "444",
        id: u, aid: "0", scy: "auto", net: "ws", type: "none", host: H, path: "/vmess", tls: ""
      }))));
    }
    if (pr === "Trojan") return "trojan://" + u + "@" + H + ":443?type=ws&path=%2Ftrojan&security=tls&host=" + H + "#" + nm;
    if (pr === "Shadowsocks") return "ss://" + btoa("chacha20-ietf-poly1305:" + u) + "@" + H + ":8388#" + nm;
    if (pr === "Hysteria2") return "hysteria2://" + u + "@" + H + ":8443?sni=" + H + "&insecure=1#" + nm;
    if (pr === "TUIC") return "tuic://" + u + ":" + u.slice(0, 8) + "@" + H + ":8443?congestion_control=bbr&alpn=h3&sni=" + H + "&allow_insecure=1#" + nm;
    if (pr === "SSH") return "ssh://root@" + H + ":22#key=" + u;
    if (pr === "WireGuard") return "wireguard://" + u + "@" + H + ":51820?address=10.66.66.2/32#" + nm;
    if (pr === "OpenVPN") return "openvpn://" + H + ":1194?proto=tcp&token=" + u + "#" + nm;
    if (pr === "SOCKS5") return "socks5://user:" + u.slice(0, 12) + "@" + H + ":1080#" + nm;
    return "vless://" + u + "@" + H + ":443?type=ws&path=%2Fvless&security=tls&encryption=none&host=" + H + "#" + nm;
  }

  function cp(t, el) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(t).catch(function() { prompt("คัดลอกลิงก์:", t); });
    } else {
      var ta = document.createElement("textarea");
      ta.value = t;
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0.01;";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (_) { prompt("คัดลอกลิงก์:", t); }
      document.body.removeChild(ta);
    }
    if (el) {
      var o = el.textContent;
      el.textContent = "✅ แล้ว";
      setTimeout(function() { el.textContent = o; }, 1100);
    }
  }

  window.toggleAllZones = function() {
    var anyOpen = ZONES.some(function(z) { return openMap[z.id] === true; });
    ZONES.forEach(function(z) { openMap[z.id] = !anyOpen; });
    draw();
  };

  window.openCreateZoneKey = function(zoneId) {
    if (dd()) dd().style.setProperty("display", "none", "important");
    var z = ZONES.find(function(x) { return x.id === zoneId; }) || ZONES[0];

    var pr = "VLESS";
    if (z.id === "admin_free" || z.id === "family") {
      var pk = prompt("[" + z.title + "] เลือกชนิดโปรโตคอล (1-10):\n" + PROTOS.map(function(p, i) { return (i + 1) + ". " + p; }).join("\n"), "1");
      if (pk === null) return;
      pr = PROTOS[(parseInt(pk, 10) || 1) - 1] || "VLESS";
    } else {
      var pk2 = prompt("[" + z.title + "] เลือกโปรโตคอล:\n1. VLESS\n2. VMess\n3. Trojan", "1");
      if (pk2 === null) return;
      pr = ["VLESS", "VMess", "Trojan"][(parseInt(pk2, 10) || 1) - 1] || "VLESS";
    }

    var countInZone = K.filter(function(k) { return k.group === z.id; }).length + 1;
    var defaultLabel = z.id === "admin_free" ? ("AdminFree-" + countInZone)
      : (z.id === "family" ? ("ครอบครัว-" + countInZone)
      : (z.id === "test" ? ("เทสต์-" + countInZone) : ("ลูกค้า-" + countInZone)));

    var un = prompt("ตั้งชื่อคีย์ [" + pr + "] ใน " + z.title + ":", defaultLabel);
    if (un === null) return;

    var unit = "days", amount = 30, unlimited = false;
    if (z.id === "admin_free") {
      var mode = prompt("กำหนดเวลาแอดมินอิสระ:\nพิมพ์ 0 = ♾️ ไม่จำกัดเวลา\nหรือใส่จำนวนวัน (เช่น 7, 30, 365):", "0");
      if (mode === null) return;
      var num = parseInt(mode, 10);
      if (!num || num <= 0) { unlimited = true; unit = "unlimited"; amount = 0; }
      else { unit = "days"; amount = num; }
    } else if (z.id === "family") {
      var fmode = prompt("กำหนดเวลากลุ่มครอบครัว (ฟรี):\nพิมพ์ 0 = ♾️ ไม่จำกัดเวลา\nหรือใส่จำนวนวัน (เช่น 7, 30, 90):", "30");
      if (fmode === null) return;
      var fnum = parseInt(fmode, 10);
      if (!fnum || fnum <= 0) { unlimited = true; unit = "unlimited"; amount = 0; }
      else { unit = "days"; amount = fnum; }
    } else if (z.id === "test") {
      var tUnit = prompt("เลือกหน่วยเวลาสำหรับกลุ่มเทสต์ (แจกฟรีผู้ร่วมทดสอบ):\n1. ชั่วโมง (ชม.)\n2. วัน (วัน)", "1");
      if (tUnit === null) return;
      unit = (String(tUnit).trim() === "2") ? "days" : "hours";
      var tAmt = prompt(unit === "hours" ? "ใส่จำนวนชั่วโมง (เช่น 1, 3, 6, 12, 24):" : "ใส่จำนวนวัน (เช่น 1, 3, 7):", unit === "hours" ? "6" : "1");
      if (tAmt === null) return;
      amount = Math.max(1, parseInt(tAmt, 10) || 1);
    } else {
      var gAmt = prompt("ใส่จำนวนวันใช้งาน (ลูกค้าทั่วไป · จ่ายเงินแล้ว เช่น 7, 15, 30, 90):", "30");
      if (gAmt === null) return;
      unit = "days";
      amount = Math.max(1, parseInt(gAmt, 10) || 30);
    }

    post("/api/dynamic-key/create", {
      groupId: z.id,
      proto: pr,
      name: (un.trim() || defaultLabel),
      unit: unit,
      amount: amount,
      unlimited: unlimited
    }).then(function(r) {
      if (r && r.ok) { openMap[z.id] = true; expMap[z.id] = true; draw(); }
      else alert((r && r.error) || "สร้างคีย์ไม่สำเร็จ");
    });
  };

  window.adjustZoneKeyTime = function(id, dir, setUnlimited) {
    if (setUnlimited) {
      post("/api/dynamic-key/time", { id: id, unlimited: true }).then(draw);
      return;
    }
    var inp = document.getElementById("z-amt-" + id);
    var unitSel = document.getElementById("z-unit-" + id);
    var amt = Math.max(1, parseInt((inp && inp.value) || "1", 10) || 1) * dir;
    var unit = unitSel ? unitSel.value : "days";
    post("/api/dynamic-key/time", { id: id, amount: amt, unit: unit, unlimited: false }).then(function(r) {
      if (r && !r.ok) alert(r.error || "ปรับเวลาไม่สำเร็จ");
      draw();
    });
  };

  window.delUsr = function(id, nm) {
    if (confirm("ยืนยันลบคีย์ #" + id + " (" + nm + ")?")) {
      post("/api/dynamic-key/delete", { id: id }).then(draw);
    }
  };

  window.resetAllKeysNow = function() {
    if (dd()) dd().style.setProperty("display", "none", "important");
    if (!confirm("⚠️ ยืนยันล้างรีเซ็ตคีย์ทั้งหมด (เหลือเฉพาะ #1 Master Admin)?")) return;
    post("/api/dynamic-key/reset-all", {}).then(function() {
      draw();
    });
  };

  window.toggleKeyStepMenu = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    var m = dd(), b = btn();
    if (!m) return;
    m.innerHTML =
      '<div style="padding:5px 8px;border-bottom:1px solid #333;color:#9ca3af;font-size:11px;font-weight:bold;">แยกสร้างคีย์ตามสัดส่วน (4 โซน)</div>' +
      '<button type="button" onclick="openCreateZoneKey(\'admin_free\')" style="display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid #2d2d2d;padding:9px 10px;color:#fbbf24;font-weight:bold;font-size:12px;cursor:pointer;">👑 1. แอดมินอิสระ (10 โปรโตคอล · ไม่จำกัด)</button>' +
      '<button type="button" onclick="openCreateZoneKey(\'family\')" style="display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid #2d2d2d;padding:9px 10px;color:#38bdf8;font-weight:bold;font-size:12px;cursor:pointer;">👨‍👩‍👧 2. กลุ่มครอบครัว (ใช้งานฟรี · อิสระ)</button>' +
      '<button type="button" onclick="openCreateZoneKey(\'test\')" style="display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid #2d2d2d;padding:9px 10px;color:#f472b6;font-weight:bold;font-size:12px;cursor:pointer;">🧪 3. กลุ่มเทสต์ (แจกฟรี · ชม. / วัน)</button>' +
      '<button type="button" onclick="openCreateZoneKey(\'general\')" style="display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid #2d2d2d;padding:9px 10px;color:#4ade80;font-weight:bold;font-size:12px;cursor:pointer;">💳 4. กลุ่มทั่วไป (ใช้งานจริง · จ่ายเงินแล้ว)</button>' +
      '<button type="button" onclick="resetAllKeysNow()" style="display:block;width:100%;text-align:left;background:none;border:none;padding:9px 10px;color:#f87171;font-weight:bold;font-size:12px;cursor:pointer;">🧹 ล้างรีเซ็ตคีย์ทั้งหมด (เหลือ #1)</button>';

    if (getComputedStyle(m).display !== "none") { m.style.setProperty("display", "none", "important"); return; }
    m.style.setProperty("display", "block", "important");
    m.style.setProperty("position", "fixed", "important");
    m.style.setProperty("z-index", "2147483647", "important");
    if (b) {
      var r = b.getBoundingClientRect();
      m.style.setProperty("left", Math.max(8, Math.min(r.left, window.innerWidth - 265)) + "px", "important");
      m.style.setProperty("top", (r.bottom + 6) + "px", "important");
    }
  };

  function formatTimeStatus(k) {
    if (k.unlimited || (k.durationDays === 0 && k.durationHours === 0)) {
      return '<span style="color:#fbbf24;font-weight:bold;">♾️ ไม่จำกัดเวลา</span>';
    }
    if (!k.started) {
      if (k.durationUnit === "hours" && k.durationHours) {
        return '<span style="color:#93c5fd;">⏳ รอเริ่มใช้ (<b>' + k.durationHours + ' ชม.</b>)</span>';
      }
      var d = k.durationDays || Math.max(1, Math.ceil((k.durationHours || 24) / 24));
      return '<span style="color:#93c5fd;">⏳ รอเริ่มใช้ (<b>' + d + ' วัน</b>)</span>';
    }
    var left = (k.expiresAt || 0) - NOW;
    if (left <= 0 || k.active === false) {
      return '<span style="color:#f87171;font-weight:bold;">⛔ หมดอายุแล้ว</span>';
    }
    var totalMins = Math.ceil(left / 60000);
    if (totalMins < 1440) {
      var hrs = Math.floor(totalMins / 60);
      var mins = totalMins % 60;
      return '<span style="color:#4ade80;font-weight:bold;">🟢 เหลือ ' + hrs + ' ชม. ' + mins + ' นาที</span>';
    }
    var daysLeft = Math.ceil(left / 86400000);
    return '<span style="color:#4ade80;font-weight:bold;">🟢 เหลือ ' + daysLeft + ' วัน</span>';
  }

  
function hbWrapSection(role, title, badgeText, accentColor) {
  const sec = document.createElement("div");
  sec.className = "hb-ui-section hb-zone-" + role;
  sec.setAttribute("data-ui-role", role);
  sec.style.cssText = "margin-top:10px;border:1px solid #3f3f46;border-radius:10px;background:#141417;overflow:hidden;";
  sec.innerHTML =
    "<div style=\"display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(255,255,255,0.03);border-bottom:1px solid #27272a;\">" +
      "<span style=\"font-weight:bold;font-size:12.5px;color:" + accentColor + ";\">" + title + "</span>" +
      "<span style=\"font-size:10.5px;color:#a1a1aa;background:#27272a;padding:2px 7px;border-radius:999px;\">" + badgeText + "</span>" +
    "</div>" +
    "<div class=\"hb-section-body\" style=\"padding:10px;display:flex;flex-direction:column;gap:8px;\"></div>";
  return sec;
}

function draw() {
    var w = document.getElementById("hbDynamicGroupsBoard");
    if (!w) {
      w = document.createElement("div");
      w.id = "hbDynamicGroupsBoard";
      w.style.cssText = "margin-top:12px;margin-bottom:24px;display:flex;flex-direction:column;gap:10px;";
      var mainTable = document.querySelector("table");
      var noteBoard = document.getElementById("hbAdminNotesBoard");
      if (mainTable && mainTable.parentNode) {
        mainTable.parentNode.insertBefore(w, mainTable);
      } else if (noteBoard && noteBoard.parentNode) {
        noteBoard.parentNode.insertBefore(w, noteBoard);
      } else {
        document.body.appendChild(w);
      }
    }
    fetch("/api/dynamic-data").then(function(r) { return r.json(); }).then(function(res) {
      if (!res || !res.ok) return;
      K = res.keys || [];
      NOW = res.now || Date.now();
      H = res.host || H;
      w.innerHTML = "";

      var anyOpen = ZONES.some(function(z) { return openMap[z.id] === true; });
      var topBar = document.createElement("div");
      topBar.style.cssText = "display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:#18181b;border:1px solid #3f3f46;border-radius:8px;padding:9px 12px;";
      topBar.innerHTML =
        '<b style="color:#f4f4f5;font-size:12.5px;">📂 แผงจัดการ 4 โซน (รวม ' + K.length + ' คีย์)</b>';
      w.appendChild(topBar);

      function placeToggleBtnUnderLogout() {
        var refreshBtnEl = document.getElementById("btnPipeAirplaneRefresh");
        var keyBtn = document.getElementById("btnKeyStepMain");
        var targetRow = refreshBtnEl ? refreshBtnEl.parentNode : (keyBtn && keyBtn.parentNode ? keyBtn.parentNode.parentNode : null);
        if (!targetRow) return;
        var btn = document.getElementById("hbToggleAllZonesBtn");
        if (!btn) {
          btn = document.createElement("button");
          btn.id = "hbToggleAllZonesBtn";
          btn.type = "button";
          btn.onclick = function() { window.toggleAllZones(); };
        }
        btn.style.cssText = "display:inline-block;background:#27272a;color:#93c5fd;border:1px solid #3b82f6;padding:8px 12px;border-radius:6px;font-size:13px;font-weight:bold;cursor:pointer;white-space:nowrap;";
        btn.textContent = anyOpen ? "▲ ยุบทั้งหมด" : "▼ กางทั้งหมด";
        if (btn.parentNode !== targetRow) {
          targetRow.appendChild(btn);
        }
      }
      placeToggleBtnUnderLogout();


      ZONES.forEach(function(z) {
        var list = K.filter(function(k) { return (k.group || "admin_free") === z.id; });
        var isOpen = openMap[z.id] === true;

        var card = document.createElement("div");
        card.style.cssText = "background:" + z.bg + ";border:1px solid " + z.border + ";border-radius:8px;overflow:hidden;";

        var hd = document.createElement("div");
        hd.style.cssText = "padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;background:rgba(255,255,255,0.03);" + (isOpen ? ("border-bottom:1px solid " + z.border + ";") : "") + "cursor:pointer;";
        hd.innerHTML =
          '<div style="flex:1;min-width:185px;">' +
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
              '<span style="color:#a1a1aa;font-size:11px;">' + (isOpen ? "▼" : "▶") + '</span>' +
              '<span style="color:' + z.accent + ';font-weight:bold;font-size:13px;">' + z.icon + ' ' + z.title + ' (' + list.length + ')</span>' +
              '<span style="background:rgba(255,255,255,0.08);color:#d4d4d8;padding:1px 6px;border-radius:4px;font-size:10px;">' + (isOpen ? "ยุบ" : "ขยาย") + '</span>' +
            '</div>' +
            '<div style="color:#a1a1aa;font-size:10.5px;margin-top:2px;">' + z.subtitle + '</div>' +
          '</div>' +
          '<button type="button" class="btn-add-zone" style="background:' + z.accent + ';color:#111;border:none;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:bold;cursor:pointer;white-space:nowrap;">+ สร้างคีย์</button>';

        hd.onclick = function(ev) {
          if (!ev.target.closest("button")) { openMap[z.id] = !isOpen; draw(); }
        };
        hd.querySelector(".btn-add-zone").onclick = function(ev) {
          ev.stopPropagation();
          openCreateZoneKey(z.id);
        };
        card.appendChild(hd);

        if (isOpen) {
          var bd = document.createElement("div");
          bd.style.cssText = "padding:8px 10px;display:flex;flex-direction:column;gap:8px;";
          if (!list.length) {
            bd.innerHTML = '<div style="color:#71717a;font-size:11.5px;padding:4px 2px;">ยังไม่มีคีย์ในโซนนี้ — กด <b>+ สร้างคีย์</b> เพื่อเพิ่มได้เลย</div>';
          }
          var vis = expMap[z.id] ? list : list.slice(0, 5);
          var hid = Math.max(0, list.length - 5);

          vis.forEach(function(k) {
            var pr = detectProto(k);
            var link = buildLink(k);
            var rw = document.createElement("div");
            rw.style.cssText = "background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:8px;display:flex;flex-direction:column;gap:6px;";

            var paidTag = (z.id === "general") ? '<span style="background:rgba(74,222,128,0.16);color:#4ade80;border:1px solid rgba(74,222,128,0.4);padding:1px 5px;border-radius:4px;font-size:10px;font-weight:bold;">💳 จ่ายเงินแล้ว</span>' : '';
            var unitHtml = z.allowHours
              ? '<select id="z-unit-' + k.id + '" style="background:#18181b;color:#fff;border:1px solid #3f3f46;border-radius:4px;padding:3px 4px;font-size:11px;"><option value="hours"' + (k.durationUnit === "hours" ? " selected" : "") + '>ชม.</option><option value="days"' + (k.durationUnit !== "hours" ? " selected" : "") + '>วัน</option></select>'
              : '<input type="hidden" id="z-unit-' + k.id + '" value="days"><span style="color:#a1a1aa;font-size:11px;">วัน</span>';
            var unlimBtn = z.allowUnlimited
              ? '<button type="button" class="btn-unlim" style="background:#78350f;color:#fde68a;border:1px solid #f59e0b;padding:3px 5px;border-radius:4px;font-size:10px;font-weight:bold;cursor:pointer;white-space:nowrap;">♾️ ไม่จำกัด</button>'
              : '';

            rw.innerHTML =
              '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">' +
                '<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">' +
                  '<span style="color:#fff;font-weight:bold;font-size:12px;">#' + k.id + ' ' + (k.name || "") + '</span>' +
                  paidTag +
                '</div>' +
                '<div>' + formatTimeStatus(k) + '</div>' +
              '</div>' +
              '<div style="display:flex;justify-content:space-between;align-items:center;gap:4px;flex-wrap:nowrap;">' +
                '<div style="display:flex;align-items:center;gap:3px;flex-wrap:nowrap;">' +
                  '<input type="number" id="z-amt-' + k.id + '" value="1" min="1" style="width:36px;padding:3px 2px;text-align:center;background:#18181b;color:#fff;border:1px solid #3f3f46;border-radius:4px;font-size:10.5px;">' +
                  unitHtml +
                  '<button type="button" class="btn-tadd" style="background:#15803d;color:#fff;border:none;padding:3px 5px;border-radius:4px;font-size:10px;font-weight:bold;cursor:pointer;white-space:nowrap;">+เพิ่ม</button>' +
                  '<button type="button" class="btn-tsub" style="background:#991b1b;color:#fff;border:none;padding:3px 5px;border-radius:4px;font-size:10px;font-weight:bold;cursor:pointer;white-space:nowrap;">-ลด</button>' +
                  unlimBtn +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:3px;flex-wrap:nowrap;">' +
                  '<button type="button" class="btn-cp" style="background:#1d4ed8;color:#fff;border:none;padding:3px 6px;border-radius:4px;font-size:10.5px;font-weight:bold;cursor:pointer;white-space:nowrap;">' + pr + '</button>' +
                  '<button type="button" class="btn-del" style="background:#dc2626;color:#fff;border:none;padding:3px 6px;border-radius:4px;font-size:10.5px;font-weight:bold;cursor:pointer;white-space:nowrap;">ลบ</button>' +
                '</div>' +
              '</div>';

            rw.querySelector(".btn-tadd").onclick = function() { adjustZoneKeyTime(k.id, 1, false); };
            rw.querySelector(".btn-tsub").onclick = function() { adjustZoneKeyTime(k.id, -1, false); };
            if (z.allowUnlimited && rw.querySelector(".btn-unlim")) {
              rw.querySelector(".btn-unlim").onclick = function() { adjustZoneKeyTime(k.id, 0, true); };
            }
            rw.querySelector(".btn-cp").onclick = function() { cp(link, this); };
            rw.querySelector(".btn-del").onclick = function() { delUsr(k.id, k.name || ""); };
            bd.appendChild(rw);
          });

          if (hid > 0) {
            var tb = document.createElement("button");
            tb.type = "button";
            tb.style.cssText = "width:100%;margin-top:2px;background:#27272a;color:#93c5fd;border:1px solid #3f3f46;border-radius:6px;padding:6px 8px;font-size:11.5px;font-weight:bold;cursor:pointer;";
            tb.textContent = expMap[z.id] ? "▲ ยุบเก็บ (แสดง 5 แถวแรก)" : ("▼ ขยายดูเพิ่มอีก " + hid + " แถว (ทั้งหมด " + list.length + " คีย์)");
            tb.onclick = function() { expMap[z.id] = !expMap[z.id]; draw(); };
            bd.appendChild(tb);
          }

          card.appendChild(bd);
        }
        w.appendChild(card);
      });
    });
  }

  function bindBtnDirect() {
    var b = btn();
    if (b && !b.dataset.dynBound) {
      b.dataset.dynBound = "1";
      b.onclick = window.toggleKeyStepMenu;
      b.addEventListener("click", window.toggleKeyStepMenu, true);
    }
  }
  bindBtnDirect();
  setTimeout(bindBtnDirect, 300);
  document.addEventListener("click", function(e) {
    var m = dd(), b = btn();
    if (m && getComputedStyle(m).display !== "none" && (!b || !b.contains(e.target)) && !m.contains(e.target)) {
      m.style.setProperty("display", "none", "important");
    }
  });
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", draw) : draw();
})();
