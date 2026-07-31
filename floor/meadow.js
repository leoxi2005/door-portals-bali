/* Bake lớp thực vật nhìn từ trên cho sàn: bụi cỏ, dương xỉ, khóm hoa, đá phủ rêu.
 *
 * Cỏ ở 2.6 px/cm là texture mịn (1 lá cỏ < 1 px) nên vẻ đẹp phải đến từ các vật thể
 * cỡ 20–60 cm — đó là những thứ vẽ ở đây. Kết quả nhét vào 1 texture RGBA:
 *   R = cao độ vật thể (0..1)     G = đá        B = thân/lá (bụi cỏ, dương xỉ)
 *   A = hoa (150 = cánh, 255 = nhuỵ)
 * Deterministic theo seed.
 */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function sdPoly(verts, p) {
    let area = 0;
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i], b = verts[(i + 1) % verts.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const or_ = area > 0 ? 1 : -1;
    let d = -1e9;
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i], b = verts[(i + 1) % verts.length];
      const ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey);
      const nx = (or_ * ey) / L, ny = (-or_ * ex) / L;
      d = Math.max(d, nx * (p[0] - a[0]) + ny * (p[1] - a[1]));
    }
    return d;
  }

  /* lối mòn — phải khớp hệ số với hàm paths() trong shader */
  function pathMask(doors, p, ring) {
    let best = 0;
    for (let i = 0; i < doors.length; i++) {
      const D = doors[i];
      const L = Math.max(0.001, Math.hypot(D[0], D[1]));
      const dx = -D[0] / L, dy = -D[1] / L;
      const px = -dy, py = dx;
      const rx = p[0] - D[0], ry = p[1] - D[1];
      const t = rx * dx + ry * dy, sN = rx * px + ry * py;
      const wob = 0.34 * Math.sin(t * 1.05 + i * 2.3) + 0.14 * Math.sin(t * 2.3 - i);
      const w = 0.34 + 0.10 * Math.sin(t * 0.75 + i);
      const d = (sN - wob) / w;
      const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
      const on = Math.exp(-d * d * 1.5) * ss(0, 0.55, t) * ss(ring * 0.72, ring * 1.25, Math.hypot(p[0], p[1]));
      if (on > best) best = on;
    }
    return best;
  }

  function bakeMeadow(geo, opts) {
    const o = Object.assign({ seed: 20260731, ring: 2.30 }, opts || {});
    const rnd = mulberry32(o.seed);
    const W = geo.W, H = geo.H, S = geo.scale;
    const V = geo.verts;
    const doors = geo.doors.map((d) => [d.p[0] + d.n[0] * 0.30, d.p[1] + d.n[1] * 0.30]);

    const mk = () => {
      const c = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(W, H)
        : Object.assign(document.createElement('canvas'), { width: W, height: H });
      const x = c.getContext('2d', { willReadFrequently: true });
      x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      x.lineCap = 'round'; x.lineJoin = 'round';
      return x;
    };
    const xh = mk(), xs = mk(), xp = mk(), xf = mk();
    const P = (p) => geo.toPx(p);
    const gray = (v) => { const n = Math.max(0, Math.min(255, Math.round(v * 255))); return 'rgb(' + n + ',' + n + ',' + n + ')'; };

    let counts = { tuft: 0, fern: 0, flower: 0, stone: 0 };

    /* ---- bụi cỏ: nan quạt các lá toả ra từ tâm ---- */
    function tuft(c, R, h) {
      const n = 16 + Math.round(rnd() * 18);
      // gò thấp ở gốc
      const A = P(c);
      const g = xh.createRadialGradient(A[0], A[1], 0, A[0], A[1], R * S * 0.9);
      g.addColorStop(0, gray(h * 0.42)); g.addColorStop(1, 'rgba(0,0,0,0)');
      xh.fillStyle = g; xh.beginPath(); xh.arc(A[0], A[1], R * S * 0.9, 0, TAU); xh.fill();
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU;
        const len = R * (0.45 + 0.55 * rnd());
        const curve = (rnd() - 0.5) * 0.9;
        const tipA = a + curve;
        const mid = [c[0] + Math.cos(a) * len * 0.55, c[1] + Math.sin(a) * len * 0.55];
        const tip = [c[0] + Math.cos(tipA) * len, c[1] + Math.sin(tipA) * len];
        const B = P(mid), C = P(tip);
        const v = h * (0.55 + 0.45 * rnd());
        for (const [ch, val, mul] of [[xh, v, 1.0], [xp, 0.85 + 0.15 * rnd(), 1.25]]) {
          ch.strokeStyle = gray(val);
          ch.lineWidth = Math.max(0.9, 0.011 * S * mul);
          ch.beginPath(); ch.moveTo(A[0], A[1]); ch.quadraticCurveTo(B[0], B[1], C[0], C[1]); ch.stroke();
        }
      }
      counts.tuft++;
    }

    /* ---- dương xỉ: sống lá cong + lá chét 2 bên ---- */
    function fern(c, dir, L, h) {
      const steps = 16;
      const bend = (rnd() - 0.5) * 1.1;
      const pts = [];
      let a = dir;
      let p = c.slice();
      for (let i = 0; i <= steps; i++) {
        pts.push(p.slice());
        a += bend / steps;
        p = [p[0] + Math.cos(a) * (L / steps), p[1] + Math.sin(a) * (L / steps)];
      }
      // sống lá
      for (const [ch, val] of [[xh, h], [xp, 0.95]]) {
        ch.strokeStyle = gray(val);
        ch.lineWidth = Math.max(1.0, 0.012 * S);
        ch.beginPath();
        pts.forEach((q, i) => { const A = P(q); i ? ch.lineTo(A[0], A[1]) : ch.moveTo(A[0], A[1]); });
        ch.stroke();
      }
      // lá chét
      for (let i = 1; i < steps; i++) {
        const f = i / steps;
        const q = pts[i];
        const t = [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]];
        const tl = Math.hypot(t[0], t[1]) || 1;
        const tx = t[0] / tl, ty = t[1] / tl;
        const ll = L * 0.30 * (1 - f * 0.85) * (0.8 + 0.4 * rnd());
        for (const sgn of [-1, 1]) {
          const ang = sgn * (0.85 + 0.25 * rnd());
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const dx = tx * ca - ty * sa, dy = tx * sa + ty * ca;
          const A = P(q), B = P([q[0] + dx * ll, q[1] + dy * ll]);
          for (const [ch, val] of [[xh, h * (0.55 + 0.35 * (1 - f))], [xp, 0.80]]) {
            ch.strokeStyle = gray(val);
            ch.lineWidth = Math.max(0.9, 0.009 * S);
            ch.beginPath(); ch.moveTo(A[0], A[1]); ch.lineTo(B[0], B[1]); ch.stroke();
          }
        }
      }
      counts.fern++;
    }

    /* ---- khóm hoa: vài bông trên cuống ngắn ---- */
    function flowerClump(c, n, scale) {
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, d = 0.16 * scale * Math.sqrt(rnd());
        const q = [c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d];
        const rad = (0.022 + 0.020 * rnd()) * scale;
        const A = P(c), B = P(q);
        // cuống
        xp.strokeStyle = gray(0.55); xp.lineWidth = Math.max(0.8, 0.006 * S);
        xp.beginPath(); xp.moveTo(A[0], A[1]); xp.lineTo(B[0], B[1]); xp.stroke();
        // cánh (5 thuỳ mềm)
        const R = rad * S;
        xf.fillStyle = gray(150 / 255);
        xf.beginPath();
        for (let k = 0; k <= 40; k++) {
          const th = (k / 40) * TAU;
          const rr = R * (0.90 + 0.10 * Math.cos(th * 5 + a));
          const px2 = B[0] + Math.cos(th) * rr, py2 = B[1] + Math.sin(th) * rr;
          k ? xf.lineTo(px2, py2) : xf.moveTo(px2, py2);
        }
        xf.closePath(); xf.fill();
        // nhuỵ
        xf.fillStyle = gray(1.0);
        xf.beginPath(); xf.arc(B[0], B[1], R * 0.34, 0, TAU); xf.fill();
        // cao độ: gò tròn nhỏ
        const g = xh.createRadialGradient(B[0], B[1], 0, B[0], B[1], R * 1.15);
        g.addColorStop(0, gray(0.62)); g.addColorStop(1, 'rgba(0,0,0,0)');
        xh.fillStyle = g; xh.beginPath(); xh.arc(B[0], B[1], R * 1.15, 0, TAU); xh.fill();
        counts.flower++;
      }
    }

    /* ---- đá phủ rêu ---- */
    function stone(c, R, rot) {
      const A = P(c);
      const rx = R * S, ry = R * S * (0.62 + 0.30 * rnd());
      xs.save(); xs.translate(A[0], A[1]); xs.rotate(rot);
      xs.fillStyle = '#fff';
      xs.beginPath();
      for (let k = 0; k <= 36; k++) {
        const th = (k / 36) * TAU;
        const wob = 1 + 0.10 * Math.sin(th * 3 + rot * 4) + 0.06 * Math.sin(th * 5 - rot);
        const px2 = Math.cos(th) * rx * wob, py2 = Math.sin(th) * ry * wob;
        k ? xs.lineTo(px2, py2) : xs.moveTo(px2, py2);
      }
      xs.closePath(); xs.fill(); xs.restore();

      const g = xh.createRadialGradient(A[0], A[1], 0, A[0], A[1], Math.max(rx, ry));
      g.addColorStop(0, gray(1.0)); g.addColorStop(0.55, gray(0.80)); g.addColorStop(1, 'rgba(0,0,0,0)');
      xh.save(); xh.translate(A[0], A[1]); xh.rotate(rot); xh.scale(1, ry / rx);
      xh.fillStyle = g; xh.beginPath(); xh.arc(0, 0, Math.max(rx, ry), 0, TAU); xh.fill(); xh.restore();
      counts.stone++;
    }

    /* ---------- rải vật thể ---------- */
    const inside = (p, margin) => sdPoly(V, p) < -(margin || 0);
    const ring = o.ring;

    // 1) vòng đá quanh giữa phòng (điểm nhấn)
    const nStone = 13;
    for (let i = 0; i < nStone; i++) {
      const a = (i / nStone) * TAU + rnd() * 0.16;
      const rr = ring * (0.97 + 0.06 * rnd());
      const c = [Math.cos(a) * rr, Math.sin(a) * rr];
      stone(c, 0.17 + 0.13 * rnd(), rnd() * TAU);
      if (rnd() < 0.8) flowerClump([c[0] + (rnd() - 0.5) * 0.5, c[1] + (rnd() - 0.5) * 0.5], 3 + Math.round(rnd() * 5), 1.0);
    }

    // 2) bụi cỏ rải khắp, thưa dần vào giữa, né lối mòn
    const RMAX = geo.circumR + 0.4;
    for (let i = 0; i < 2600; i++) {
      const p = [(rnd() * 2 - 1) * RMAX, (rnd() * 2 - 1) * RMAX];
      if (!inside(p, -0.10)) continue;
      const rr = Math.hypot(p[0], p[1]);
      const pm = pathMask(doors, p, ring);
      let prob = 0.85 * (0.30 + 0.70 * Math.min(1, rr / (ring * 1.35))) * (1 - 0.92 * pm);
      if (rr < ring * 0.92) prob *= 0.35;                 // trong vòng đá: cỏ thấp
      if (rnd() > prob) continue;
      tuft(p, 0.10 + 0.13 * rnd(), 0.55 + 0.45 * rnd());
    }

    // 3) dương xỉ theo cụm, chủ yếu gần chân tường
    for (let k = 0; k < 34; k++) {
      const p0 = [(rnd() * 2 - 1) * RMAX, (rnd() * 2 - 1) * RMAX];
      if (!inside(p0, 0.15) || Math.hypot(p0[0], p0[1]) < ring * 1.25) { k--; continue; }
      const n = 3 + Math.round(rnd() * 5);
      for (let i = 0; i < n; i++) {
        const p = [p0[0] + (rnd() - 0.5) * 0.9, p0[1] + (rnd() - 0.5) * 0.9];
        if (!inside(p, 0.05) || pathMask(doors, p, ring) > 0.30) continue;
        fern(p, rnd() * TAU, 0.28 + 0.26 * rnd(), 0.60 + 0.35 * rnd());
      }
    }

    // 4) khóm hoa rải rác
    for (let i = 0; i < 220; i++) {
      const p = [(rnd() * 2 - 1) * RMAX, (rnd() * 2 - 1) * RMAX];
      if (!inside(p, 0.10)) continue;
      const rr = Math.hypot(p[0], p[1]);
      if (pathMask(doors, p, ring) > 0.28) continue;
      const near = Math.exp(-Math.pow((rr - ring) / 0.75, 2));
      if (rnd() > 0.22 + 0.70 * near) continue;
      flowerClump(p, 2 + Math.round(rnd() * 5), 0.75 + 0.5 * rnd());
    }

    // 5) vài hòn đá lẻ
    for (let i = 0; i < 16; i++) {
      const p = [(rnd() * 2 - 1) * RMAX, (rnd() * 2 - 1) * RMAX];
      if (!inside(p, 0.25) || Math.hypot(p[0], p[1]) < ring * 1.2) { i--; continue; }
      if (pathMask(doors, p, ring) > 0.25) continue;
      stone(p, 0.07 + 0.10 * rnd(), rnd() * TAU);
    }

    // 6) cánh hoa rụng + đá dẹt trong lòng vòng đá
    for (let i = 0; i < 260; i++) {
      const a = rnd() * TAU, d = ring * 0.95 * Math.sqrt(rnd());
      const p = [Math.cos(a) * d, Math.sin(a) * d];
      if (!inside(p, 0.05)) continue;
      const A = P(p);
      const rr = (0.010 + 0.014 * rnd()) * S;
      xf.save(); xf.translate(A[0], A[1]); xf.rotate(rnd() * TAU);
      xf.fillStyle = gray(0.36);
      xf.beginPath(); xf.ellipse(0, 0, rr, rr * 0.55, 0, 0, TAU); xf.fill();
      xf.restore();
      counts.flower++;
    }
    for (let i = 0; i < 9; i++) {
      const a = rnd() * TAU, d = ring * 0.80 * Math.sqrt(rnd());
      stone([Math.cos(a) * d, Math.sin(a) * d], 0.05 + 0.07 * rnd(), rnd() * TAU);
    }

    const dh = xh.getImageData(0, 0, W, H).data;
    const ds = xs.getImageData(0, 0, W, H).data;
    const dp = xp.getImageData(0, 0, W, H).data;
    const df = xf.getImageData(0, 0, W, H).data;
    const out = new Uint8Array(W * H * 4);
    for (let i = 0, n = W * H; i < n; i++) {
      out[i * 4] = dh[i * 4];
      out[i * 4 + 1] = ds[i * 4];
      out[i * 4 + 2] = dp[i * 4];
      out[i * 4 + 3] = df[i * 4];
    }
    return { data: out, width: W, height: H, counts };
  }

  const api = { bakeMeadow, mulberry32, sdPoly, pathMask };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.FloorMeadow = api;
})(typeof window !== 'undefined' ? window : null);
