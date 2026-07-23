// On-screen operator tools for setting up / calibrating the install.
// All layers are plain DOM / 2D-canvas ON TOP of the WebGL canvas — the NDI feed
// is read from the WebGL canvas, so NONE of this shows in the projection.
//
//   press  O        → OSC MONITOR (explains the input, shows every packet live)
//   press  Shift+M  → WALL & ZONE MAP (which screen area = which wall = which NDI
//                                       / OSC address; every door labelled w/ zone)

import * as THREE from 'three';

const WALL_HUES = [205, 42, 150, 320, 265]; // distinct colour per wall

function injectStyle() {
  const s = document.createElement('style');
  s.textContent = `
    #oscmon {
      position: fixed; top: 10px; right: 12px; max-width: 48vw;
      font: 11px/1.55 "SF Mono", Menlo, monospace;
      color: #cfe9ff; background: rgba(3, 10, 20, 0.82);
      padding: 10px 13px; border-radius: 10px; white-space: pre;
      pointer-events: none; z-index: 12; border: 1px solid rgba(120,180,255,0.25);
    }
    #wallmap { position: fixed; pointer-events: none; z-index: 11; }
    #guide {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      font: 13px/1.7 "SF Mono", Menlo, monospace; color: #eaf4ff;
      background: rgba(4, 12, 24, 0.94); padding: 20px 26px; border-radius: 14px;
      white-space: pre; pointer-events: none; z-index: 13;
      border: 1px solid rgba(120,180,255,0.35); box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }
    #guide b { color: #ffd98a; }
    #guide i { color: #8fffc8; font-style: normal; }
    .dbg-hidden { display: none !important; }
  `;
  document.head.appendChild(s);
}

function clock2() {
  const d = new Date(), p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

export function initDebugOverlays({ gl, camera, walls, doors, H, osc }) {
  injectStyle();
  const zonePort = osc?.port ?? 7000;

  // door -> { wi, dj, addr } : which wall / which door-on-wall / expected zone address
  const doorInfo = new Map();
  walls.forEach((w, wi) => (w.doors || []).forEach((d, dj) => {
    doorInfo.set(d, { wi, dj, addr: `/tuong${wi + 1}/zone/cua${dj + 1}` });
  }));

  // ============================================================= SETUP GUIDE
  const guide = document.createElement('div');
  guide.id = 'guide'; guide.className = 'dbg-hidden';
  guide.innerHTML =
    `<b>HƯỚNG DẪN KẾT NỐI CẢM BIẾN</b>   (bridge → app)      [phím G để ẩn]\n` +
    `────────────────────────────────────────────────\n` +
    `Trong app LiDAR bridge → phần OSC output, đặt:\n` +
    `   • Host   :  <i>IP máy chạy app này</i>  (cùng máy = 127.0.0.1)\n` +
    `   • Port   :  <i>${zonePort}</i>\n` +
    `   • Prefix mỗi Mặt   :  <i>tuong1, tuong2, tuong3, tuong4, tuong5</i>\n` +
    `   • Tên zone mỗi cửa :  <i>cua1, cua2</i>  (theo từng tường)\n` +
    `   • Giá trị  :  <i>1</i> = chạm (mở)   ·   <i>0</i> = thả (đóng)\n` +
    `   →  địa chỉ tự thành:  <i>/tuong2/zone/cua1</i>\n` +
    `\n` +
    `<b>QUY TRÌNH LẮP ĐẶT</b>\n` +
    `   1. Bridge trỏ về  IP:${zonePort} , đặt tên tuong/cua như trên\n` +
    `   2. Bấm <i>O</i>       → xem gói OSC tới (đúng địa chỉ chưa)\n` +
    `   3. Bấm <i>Shift+M</i> → gán NDI DOOR-WALL-1..5 đúng tường (MadMapper)\n` +
    `   4. Chạm thử  → cửa đúng nháy trắng & mở ra\n` +
    `\n` +
    `<b>PHÍM TẮT</b>   G=hướng dẫn · O=OSC monitor · Shift+M=bản đồ tường\n` +
    `              1-9=mở cửa · H=HUD · M=tắt tiếng`;
  document.body.appendChild(guide);

  // ============================================================= OSC MONITOR
  const mon = document.createElement('div');
  mon.id = 'oscmon'; mon.className = 'dbg-hidden';
  document.body.appendChild(mon);
  const log = [];
  const portCount = {};
  let lastTrigger = '(chưa có cửa nào được trigger)';
  function logOsc(msg) {
    portCount[msg.port] = (portCount[msg.port] || 0) + 1;
    const args = msg.args.map(a => typeof a === 'number' ? a.toFixed(2) : JSON.stringify(a)).join(' ');
    log.unshift(`${clock2()}  :${msg.port}  ${msg.address}  [ ${args} ]`);
    if (log.length > 12) log.pop();
  }
  function noteTrigger(door, address, on) {
    lastTrigger = `${on ? '▶ MỞ ' : '■ ĐÓNG'}  D${door.index + 1}   ←   ${address}`;
  }
  setInterval(() => {
    if (mon.classList.contains('dbg-hidden')) return;
    const counts = Object.keys(portCount).sort().map(p => `:${p}×${portCount[p]}`).join('   ') || '— chưa nhận gói nào —';
    mon.textContent =
      `OSC MONITOR   (phím O để ẩn)\n` +
      `App đang NGHE nhận chạm từ cảm biến:\n` +
      `  • cổng ${zonePort}  →  ZONES (khuyến nghị)\n` +
      `  • cổng ${walls.map(w => w.oscPort).join(',')}  →  x,y dự phòng\n` +
      `Cảm biến bắn:  /tuongN/zone/cuaM = 1 (chạm) / 0 (thả)\n` +
      `──────────────────────────────\n` +
      `đã nhận:  ${counts}\n` +
      `cửa vừa xử lý:  ${lastTrigger}\n` +
      `──────────────────────────────\n` +
      (log.join('\n') || '(chạm thử / gửi OSC để thấy gói tin ở đây)');
  }, 150);

  // ============================================================= WALL & ZONE MAP
  const cv = document.createElement('canvas');
  cv.id = 'wallmap'; cv.className = 'dbg-hidden';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  const touches = [];              // legacy x,y dots
  const zoneFlash = new Map();     // door -> performance.now()
  function logTouch(xm, ym, port) { touches.push({ xm, ym, port, t: performance.now() }); if (touches.length > 40) touches.shift(); }
  function flashZone(door) { zoneFlash.set(door, performance.now()); }

  const _v = new THREE.Vector3();
  function toScreen(x, y, z) {
    _v.set(x, y, z).project(camera);
    return [(_v.x * 0.5 + 0.5) * cv.width, (1 - (_v.y * 0.5 + 0.5)) * cv.height];
  }

  function draw() {
    requestAnimationFrame(draw);
    if (cv.classList.contains('dbg-hidden')) return;
    const r = gl.getBoundingClientRect();
    if (cv.width !== Math.round(r.width) || cv.height !== Math.round(r.height)) {
      cv.width = Math.round(r.width); cv.height = Math.round(r.height);
    }
    cv.style.left = r.left + 'px'; cv.style.top = r.top + 'px';
    cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
    ctx.clearRect(0, 0, cv.width, cv.height);
    const now = performance.now();

    // wall bands + headers
    walls.forEach((w, i) => {
      const hue = WALL_HUES[i % WALL_HUES.length];
      const a = toScreen(w.x0, H, 0), b = toScreen(w.x0 + w.wm, H, 0);
      const c = toScreen(w.x0 + w.wm, 0, 0), d = toScreen(w.x0, 0, 0);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
      ctx.fillStyle = `hsla(${hue},80%,55%,0.08)`; ctx.fill();
      ctx.strokeStyle = `hsla(${hue},85%,65%,0.85)`; ctx.lineWidth = 2; ctx.stroke();
      const [lx, ly] = toScreen(w.x0 + w.wm * 0.5, H * 0.96, 0);
      ctx.textAlign = 'center'; ctx.fillStyle = `hsla(${hue},90%,80%,1)`;
      ctx.font = 'bold 15px "SF Mono", Menlo, monospace';
      ctx.fillText(`TƯỜNG ${i + 1}`, lx, ly);
      ctx.font = '11px "SF Mono", Menlo, monospace';
      ctx.fillText(`NDI: ${w.ndiName || 'DOOR-WALL-' + (i + 1)}   ${w.cropW ? w.cropW + '×' + cv.height : ''}`, lx, ly + 15);
      ctx.fillText(`OSC: /tuong${i + 1}/…`, lx, ly + 29);
    });

    // doors: hit-zone box + the exact zone address it responds to
    ctx.textAlign = 'left';
    for (const dr of doors) {
      const info = doorInfo.get(dr);
      const hue = info ? WALL_HUES[info.wi % WALL_HUES.length] : 40;
      const h = dr.hitRect();
      const p0 = toScreen(h.x0, h.y1, 0), p1 = toScreen(h.x1, h.y0, 0);
      const x = Math.min(p0[0], p1[0]), y = Math.min(p0[1], p1[1]);
      const wpx = Math.abs(p1[0] - p0[0]), hpx = Math.abs(p1[1] - p0[1]);
      const flashT = zoneFlash.get(dr);
      const flashing = flashT && (now - flashT) < 600;
      const open = dr.state !== 'idle';
      ctx.strokeStyle = flashing ? 'rgba(255,255,255,0.95)'
        : open ? 'rgba(120,255,150,0.9)' : `hsla(${hue},85%,70%,0.8)`;
      ctx.lineWidth = flashing ? 3 : 1.5; ctx.strokeRect(x, y, wpx, hpx);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = 'bold 12px "SF Mono", Menlo, monospace';
      ctx.fillText(`D${dr.index + 1}`, x + 4, y + 15);
      if (info) {
        ctx.font = '10px "SF Mono", Menlo, monospace';
        ctx.fillText(info.addr, x + 4, y + hpx - 6);
      }
    }

    // legacy x,y touch dots
    for (const p of touches) {
      const age = (now - p.t) / 1000; if (age > 2) continue;
      const al = 1 - age / 2; const [sx, sy] = toScreen(p.xm, p.ym, 0.3);
      ctx.beginPath(); ctx.arc(sx, sy, 8 + age * 30, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(120,255,190,${al})`; ctx.lineWidth = 2; ctx.stroke();
    }

    ctx.textAlign = 'left'; ctx.font = '12px "SF Mono", Menlo, monospace';
    ctx.fillStyle = 'rgba(220,235,255,0.9)';
    ctx.fillText('BẢN ĐỒ TƯỜNG & ZONE (Shift+M ẩn) — mỗi tường = 1 luồng NDI · mỗi cửa = 1 địa chỉ OSC', 12, cv.height - 14);
  }
  requestAnimationFrame(draw);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'g' || e.key === 'G') guide.classList.toggle('dbg-hidden');
    if (e.key === 'o' || e.key === 'O') mon.classList.toggle('dbg-hidden');
    if (e.key === 'M') cv.classList.toggle('dbg-hidden'); // Shift+M (m alone = mute)
  });

  return { logOsc, logTouch, flashZone, noteTrigger };
}
