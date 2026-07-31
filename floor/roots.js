/* Bake "mạng rễ sáng": 9 hệ rễ mọc từ chân 9 cửa vào hồ sáng giữa phòng.
 * Vẽ bằng canvas 2D rồi nhét vào 1 texture RGBA:
 *   R = lõi rễ (nét mảnh, sắc)      B = quầng sáng (nét dày, alpha thấp, cộng dồn)
 *   G = độ dài dọc rễ 0→1 (0 ở cửa, 1 ở hồ) — dùng cho mạch sáng chạy vào giữa
 *   A = cấp nhánh (0 = thân chính)
 * Deterministic: cùng seed → cùng hình, render lại bao nhiêu lần cũng khớp.
 */
(function (global) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* khoảng cách có dấu tới ngũ giác lồi: âm = trong phòng (mét) */
  function sdPoly(verts, p) {
    let area = 0;
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i], b = verts[(i + 1) % verts.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const orient = area > 0 ? 1 : -1;
    let d = -1e9;
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i], b = verts[(i + 1) % verts.length];
      const ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey);
      const nx = (orient * ey) / L, ny = (-orient * ex) / L;   // pháp tuyến ngoài
      d = Math.max(d, nx * (p[0] - a[0]) + ny * (p[1] - a[1]));
    }
    return d;
  }

  /* Mọc 1 hệ rễ. Trả về mảng segment {a,b,w,g0,g1,ord} toạ độ MÉT. */
  function growSystem(door, opt, rnd) {
    const segs = [];
    const C = [0, 0];
    const start = [door.p[0] + door.n[0] * -0.12, door.p[1] + door.n[1] * -0.12];
    const D0 = Math.max(0.5, Math.hypot(start[0], start[1]) - opt.poolR);

    const queue = [{
      p: start.slice(),
      dir: door.n.slice(),
      w: opt.trunkW,
      ord: 0,
      travelled: 0,
      life: opt.maxSteps,
      wander: 0,
    }];

    let guard = 0;
    while (queue.length && guard++ < 4000) {
      const b = queue.shift();
      let p = b.p, dir = b.dir, travelled = b.travelled;
      for (let i = 0; i < b.life; i++) {
        const distC = Math.hypot(p[0], p[1]);
        if (distC < (opt.stopR || opt.poolR * (1.00 + 0.13 * rnd()))) break;
        // cho phép nhô ra ngoài tường chút (rễ chui từ dưới chân tường ra)
        if (sdPoly(opt.verts, p) > 0.16) break;

        // hướng: pha giữa "về tâm" và "hướng hiện tại" + dao động
        let toC = [(C[0] - p[0]) / distC, (C[1] - p[1]) / distC];
        if (opt.spiral) {   // lệch hướng về tâm một góc -> rễ chảy xoắn, không lao thẳng
          const sa2 = Math.sin(opt.spiral), ca2 = Math.cos(opt.spiral);
          toC = [toC[0] * ca2 - toC[1] * sa2, toC[0] * sa2 + toC[1] * ca2];
        }
        let bias = opt.bias[Math.min(b.ord, opt.bias.length - 1)];
        // đoạn đầu bám men tường, càng vào trong càng hướng tâm
        bias *= (b.ord === 0) ? Math.min(1, Math.max(0.45, travelled / D0 / 0.55)) : 1.0;
        b.wander += (rnd() - 0.5) * opt.wanderAmt;
        b.wander *= 0.86;
        const wa = b.wander;
        let nx = dir[0] * (1 - bias) + toC[0] * bias;
        let ny = dir[1] * (1 - bias) + toC[1] * bias;
        const cw = Math.cos(wa), sw = Math.sin(wa);
        const rx = nx * cw - ny * sw, ry = nx * sw + ny * cw;
        const L = Math.hypot(rx, ry) || 1;
        dir = [rx / L, ry / L];

        const step = opt.step * (0.8 + 0.4 * rnd());
        const np = [p[0] + dir[0] * step, p[1] + dir[1] * step];

        const g0 = Math.min(1, travelled / D0);
        travelled += step;
        const g1 = Math.min(1, travelled / D0);
        const taper = Math.pow(1 - Math.min(1, travelled / (D0 * 2.30)), 0.70);
        const w = Math.max(opt.minW, b.w * (0.35 + 0.65 * taper));
        segs.push({ a: p, b: np, w, g0, g1, ord: b.ord });
        p = np;

        // rẽ nhánh
        const pBr = opt.branchP[Math.min(b.ord, opt.branchP.length - 1)];
        if (b.ord < opt.maxOrd && i > 1 && rnd() < pBr) {
          const sgn = rnd() < 0.5 ? -1 : 1;
          const ang = (opt.branchAng[0] + rnd() * (opt.branchAng[1] - opt.branchAng[0])) * sgn;
          const ca = Math.cos(ang), sa = Math.sin(ang);
          queue.push({
            p: p.slice(),
            dir: [dir[0] * ca - dir[1] * sa, dir[0] * sa + dir[1] * ca],
            w: b.w * (0.60 + 0.12 * rnd()),
            ord: b.ord + 1,
            travelled,
            life: Math.max(4, Math.floor((b.life - i) * (0.45 + 0.35 * rnd()))),
            wander: 0,
          });
        }
      }
    }
    return segs;
  }

  function bakeRoots(geo, opts) {
    const o = Object.assign({
      seed: 20260731,
      poolR: 1.15,
      trunkW: 0.165,     // bề dày thân rễ (m)
      minW: 0.017,
      step: 0.16,
      maxSteps: 135,
      maxOrd: 2,
      wanderAmt: 0.34,
      bias: [0.30, 0.22, 0.14],
      branchP: [0.12, 0.09, 0.0],
      branchAng: [0.24, 0.62],
      spiral: 0.0,
    }, opts || {});
    o.verts = geo.verts;

    const rnd = mulberry32(o.seed);
    let segs = [];
    geo.doors.forEach((d, i) => {
      const sp = (i % 2 === 0 ? 1 : -1) * (0.80 + 0.14 * rnd());   // xoáy quanh hồ
      [[-1, 0.78], [1, 1.0]].forEach(([side, wf]) => {
        // xuất phát chếch dọc theo tường (2 rễ toè 2 phía chân cửa)
        const n = [d.n[0] * 0.80 + d.t[0] * 0.60 * side, d.n[1] * 0.80 + d.t[1] * 0.60 * side];
        const L2 = Math.hypot(n[0], n[1]);
        n[0] /= L2; n[1] /= L2;
        segs = segs.concat(growSystem({ p: d.p, n },
          Object.assign({}, o, { trunkW: o.trunkW * wf, spiral: sp, stopR: o.poolR * 1.30 + 0.25 * rnd() }), rnd));
      });
    });

    // vài rễ phụ mảnh mọc từ mép tường (không phải cửa) cho nền đỡ trống
    const extra = [];
    for (let i = 0; i < 5; i++) {
      const a = geo.verts[i], b = geo.verts[(i + 1) % 5];
      const n0 = [-(b[1] - a[1]), b[0] - a[0]];
      const Ln = Math.hypot(n0[0], n0[1]) || 1;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let nx = n0[0] / Ln, ny = n0[1] / Ln;
      if (mid[0] * nx + mid[1] * ny > 0) { nx = -nx; ny = -ny; }
      const cnt = Math.max(3, Math.round((o.perimDensity || 0.75) * Math.hypot(b[0] - a[0], b[1] - a[1])));
      for (let k = 0; k < cnt; k++) {
        const f = 0.05 + 0.90 * ((k + 0.35 + 0.30 * rnd()) / cnt);
        const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
        const side = rnd() < 0.5 ? -1 : 1;
        const tx = (b[0] - a[0]) / Math.hypot(b[0] - a[0], b[1] - a[1]);
        const ty = (b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1]);
        const dx = nx * 0.85 + tx * 0.52 * side, dy = ny * 0.85 + ty * 0.52 * side;
        const Ld = Math.hypot(dx, dy);
        extra.push(...growSystem(
          { p, n: [dx / Ld, dy / Ld] },
          Object.assign({}, o, {
            trunkW: 0.026 + 0.052 * rnd(),
            maxSteps: 20 + Math.round(38 * rnd()),
            maxOrd: 2, wanderAmt: 0.38, spiral: (side > 0 ? 0.95 : -0.95),
            bias: [0.20, 0.14, 0.08], branchP: [0.13, 0.09, 0],
            stopR: o.poolR * 1.25 + rnd() * 2.60,
          }), rnd));
      }
    }
    segs = segs.concat(extra);

    // ---- vẽ ra 3 canvas rồi trộn thành 1 texture ----
    const W = geo.W, H = geo.H, S = geo.scale;
    const mk = () => {
      const c = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
      const x = c.getContext('2d', { willReadFrequently: true });
      x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      x.lineCap = 'round'; x.lineJoin = 'round';
      return [c, x];
    };
    const [cCore, xCore] = mk(), [cHalo, xHalo] = mk(), [cArc, xArc] = mk(), [cVein, xVein] = mk();

    const P = (p) => geo.toPx(p);
    xHalo.globalCompositeOperation = 'lighter';

    // quầng sáng: nhiều lượt nét dày alpha thấp
    const haloPass = [[6.0, 0.018], [3.2, 0.026], [1.8, 0.034]];
    for (const [mul, al] of haloPass) {
      xHalo.strokeStyle = 'rgba(255,255,255,' + al + ')';
      for (const s of segs) {
        const A = P(s.a), B = P(s.b);
        xHalo.lineWidth = Math.max(1.2, s.w * S * mul);
        xHalo.beginPath(); xHalo.moveTo(A[0], A[1]); xHalo.lineTo(B[0], B[1]); xHalo.stroke();
      }
    }

    // độ dài dọc rễ (vẽ dày hơn lõi để phủ cả quầng)
    for (const s of segs) {
      const A = P(s.a), B = P(s.b);
      const gm = Math.round(255 * Math.min(1, (s.g0 + s.g1) / 2));
      xArc.strokeStyle = 'rgb(' + gm + ',' + gm + ',' + gm + ')';
      xArc.lineWidth = Math.max(2, s.w * S * 5.0);
      xArc.beginPath(); xArc.moveTo(A[0], A[1]); xArc.lineTo(B[0], B[1]); xArc.stroke();
    }

    // cao độ rễ: vẽ vòm (nhiều lượt thu nhỏ dần, sáng dần) — rễ mảnh thì thấp
    const maxW = segs.reduce((a, s2) => Math.max(a, s2.w), 0.001);
    const STEPS = 7;
    for (let i = 0; i < STEPS; i++) {
      const f = i / (STEPS - 1);          // 0 = mép ngoài, 1 = đỉnh
      const wf = 1 - f;
      const dome = Math.sqrt(Math.max(0, 1 - wf * wf));
      for (const s2 of segs) {
        const A = P(s2.a), B = P(s2.b);
        const v = Math.round(255 * Math.min(1, Math.pow(s2.w / maxW, 0.55)) * dome);
        xCore.strokeStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
        xCore.lineWidth = Math.max(0.8, s2.w * S * wf);
        xCore.beginPath(); xCore.moveTo(A[0], A[1]); xCore.lineTo(B[0], B[1]); xCore.stroke();
      }
    }

    // mạch sáng: chỉ rễ đủ to mới có, độ sáng theo bề dày
    const wMax = segs.reduce((a, s2) => Math.max(a, s2.w), 0.001);
    for (const s2 of segs) {
      const k = Math.max(0, (s2.w - 0.058) / Math.max(1e-4, wMax - 0.058));
      if (k <= 0.02) continue;
      const A = P(s2.a), B = P(s2.b);
      xVein.strokeStyle = 'rgb(' + (Math.round(255 * Math.pow(k, 0.8))) + ',0,0)';
      xVein.lineWidth = Math.max(0.8, s2.w * S * 0.22);
      xVein.beginPath(); xVein.moveTo(A[0], A[1]); xVein.lineTo(B[0], B[1]); xVein.stroke();
    }

    const dCore = xCore.getImageData(0, 0, W, H).data;
    const dVein = xVein.getImageData(0, 0, W, H).data;
    const dHalo = xHalo.getImageData(0, 0, W, H).data;
    const dArc = xArc.getImageData(0, 0, W, H).data;
    const out = new Uint8Array(W * H * 4);
    for (let i = 0, n = W * H; i < n; i++) {
      out[i * 4 + 0] = dCore[i * 4];
      out[i * 4 + 1] = dArc[i * 4];
      out[i * 4 + 2] = dHalo[i * 4];
      out[i * 4 + 3] = dVein[i * 4];
    }
    return { data: out, width: W, height: H, segCount: segs.length };
  }

  const api = { bakeRoots, mulberry32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.FloorRoots = api;
})(typeof window !== 'undefined' ? window : null);
