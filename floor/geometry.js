/* Hình học sàn — dùng chung cho renderer và clip CALIB.
 *
 * 5 bề rộng tường (config.json → walls[].wcm) không đủ xác định một ngũ giác,
 * nên ta dùng ngũ giác NỘI TIẾP ĐƯỜNG TRÒN: với 5 cạnh cho trước hình này là
 * DUY NHẤT (giải R bằng nhị phân từ Σ 2·asin(sᵢ/2R) = 2π).
 * Nếu sau này đo được góc thật, thay verts trong buildGeometry là xong.
 */
(function (global) {
  'use strict';

  function circumRadius(sides) {
    const f = (R) => sides.reduce((s, a) => s + 2 * Math.asin(Math.min(1, a / (2 * R))), 0) - 2 * Math.PI;
    let lo = Math.max(...sides) / 2 + 1e-9, hi = 1000;
    for (let i = 0; i < 300; i++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  // Ngũ giác nội tiếp từ 5 cạnh (mét). Trả về 5 đỉnh, đã dời về trọng tâm diện tích.
  function cyclicPolygon(sides) {
    const R = circumRadius(sides);
    let a = 0; const P = [];
    for (const s of sides) { P.push([R * Math.cos(a), R * Math.sin(a)]); a += 2 * Math.asin(s / (2 * R)); }
    // trọng tâm diện tích
    let A = 0, cx = 0, cy = 0;
    for (let i = 0; i < P.length; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length];
      const cr = x1 * y2 - x2 * y1; A += cr; cx += (x1 + x2) * cr; cy += (y1 + y2) * cr;
    }
    A /= 2; cx /= 6 * A; cy /= 6 * A;
    return { verts: P.map(([x, y]) => [x - cx, y - cy]), R, area: Math.abs(A) };
  }

  function rot(p, d) { const c = Math.cos(d), s = Math.sin(d); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; }

  /* walls: [{wcm, doors:[0..1]}] theo thứ tự tường 1..5
   * opts: { W, H, rotDeg, fit, flip }
   *   fit  = ngũ giác chiếm bao nhiêu phần chiều cao khung (chừa chỗ cho bleed)
   *   flip = đảo chiều đi vòng quanh phòng (nếu on-site thấy tường ngược chiều)
   */
  function buildGeometry(walls, opts) {
    const o = Object.assign({ W: 3840, H: 2160, rotDeg: 0, fit: 1.0, flip: false, fill: true }, opts || {});
    const sides = walls.map((w) => w.wcm / 100);
    const src = cyclicPolygon(sides);

    let verts = src.verts.map((p) => rot(p, (o.rotDeg * Math.PI) / 180));
    let order = walls.map((w, i) => i);
    if (o.flip) { verts = verts.map(([x, y]) => [-x, y]); verts.reverse(); order.reverse(); }

    // đảm bảo đi ngược chiều kim đồng hồ trong hệ toạ độ mét (y lên)
    let sA = 0;
    for (let i = 0; i < 5; i++) { const a = verts[i], b = verts[(i + 1) % 5]; sA += a[0] * b[1] - b[0] * a[1]; }
    const ccw = sA > 0;

    const xs = verts.map((p) => p[0]), ys = verts.map((p) => p[1]);
    const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
    // fill = khung 4K CHÍNH LÀ mặt bằng sàn -> px/m khác nhau theo 2 trục, để khi
    // MadMapper kéo khung 16:9 lên sàn gần vuông thì mọi thứ tròn trở lại
    const sx = o.fill ? (o.W / bw) : Math.min((o.W * o.fit) / bw, (o.H * o.fit) / bh);
    const sy = o.fill ? (o.H / bh) : sx;
    const scale = Math.sqrt(sx * sy);                              // px trên mét (trung bình hình học)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;

    // mét -> pixel (y lật xuống cho toạ độ ảnh)
    const toPx = (p) => [o.W / 2 + (p[0] - cx) * sx, o.H / 2 - (p[1] - cy) * sy];

    // 9 cửa: mỗi tường i nằm giữa verts[i] và verts[i+1]
    const doors = [];
    walls.forEach((w, i) => {
      const a = verts[i], b = verts[(i + 1) % 5];
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const L = Math.hypot(ex, ey);
      // pháp tuyến hướng vào trong phòng
      let nx = ccw ? -ey / L : ey / L, ny = ccw ? ex / L : -ex / L;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (mid[0] * nx + mid[1] * ny > 0) { nx = -nx; ny = -ny; } // luôn trỏ về tâm
      (w.doors || []).forEach((f) => {
        doors.push({
          wall: i + 1, frac: f,
          p: [a[0] + ex * f, a[1] + ey * f],
          n: [nx, ny],
          t: [ex / L, ey / L],
          wallLen: L,
        });
      });
    });

    return {
      W: o.W, H: o.H, scale, sx, sy, verts, vertsPx: verts.map(toPx), doors,
      doorsPx: doors.map((d) => toPx(d.p)), toPx,
      area: src.area, circumR: src.R, sides, order,
      bbox: [bw, bh],
    };
  }

  const api = { cyclicPolygon, buildGeometry, circumRadius };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.FloorGeo = api;
})(typeof window !== 'undefined' ? window : null);
