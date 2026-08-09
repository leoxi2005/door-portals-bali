/* Clip/ảnh CALIB: chiếu lên sàn rồi kéo 4 góc surface trong MadMapper cho tới khi
 * viền ngũ giác trùng chân 5 bức tường. Vạch cửa phải trùng đúng ô cửa thật. */
(function () {
  'use strict';
  const P = window.FLOOR_PARAMS;
  const geo = window.FloorGeo.buildGeometry(P.walls, { W: P.W, H: P.H, rotDeg: P.rot, fit: P.fit, flip: P.flip });
  const c = document.getElementById('c');
  c.width = P.W; c.height = P.H;
  const x = c.getContext('2d');
  const S = geo.scale;
  const px = (p) => geo.toPx(p);
  const k = P.W / 3840;

  x.fillStyle = '#000'; x.fillRect(0, 0, P.W, P.H);

  // lưới 1 m (cắt trong ngũ giác)
  x.save();
  x.beginPath();
  geo.vertsPx.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
  x.closePath(); x.clip();
  x.strokeStyle = 'rgba(0,190,255,0.30)'; x.lineWidth = 2 * k;
  for (let i = -6; i <= 6; i++) {
    const a = px([i, -9]), b = px([i, 9]);
    x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
    const cc = px([-9, i]), d = px([9, i]);
    x.beginPath(); x.moveTo(cc[0], cc[1]); x.lineTo(d[0], d[1]); x.stroke();
  }
  x.restore();

  // ngũ giác
  x.strokeStyle = '#fff'; x.lineWidth = 7 * k;
  x.beginPath();
  geo.vertsPx.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
  x.closePath(); x.stroke();

  // tâm + vòng hồ
  const C = px([0, 0]);
  x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 3 * k;
  x.beginPath(); x.arc(C[0], C[1], P.poolR * S, 0, 7); x.stroke();
  x.beginPath(); x.moveTo(C[0] - 60 * k, C[1]); x.lineTo(C[0] + 60 * k, C[1]);
  x.moveTo(C[0], C[1] - 60 * k); x.lineTo(C[0], C[1] + 60 * k); x.stroke();

  // đỉnh
  x.font = (52 * k | 0) + 'px -apple-system, Helvetica, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  geo.vertsPx.forEach((p, i) => {
    const dir = [C[0] - p[0], C[1] - p[1]];
    const L = Math.hypot(dir[0], dir[1]);
    const q = [p[0] + (dir[0] / L) * 95 * k, p[1] + (dir[1] / L) * 95 * k];
    x.fillStyle = '#ffcc00';
    x.beginPath(); x.arc(p[0], p[1], 17 * k, 0, 7); x.fill();
    x.fillText('V' + (i + 1), q[0], q[1]);
  });

  // tường + cửa
  const walls = P.walls;
  geo.verts.forEach((a, i) => {
    const b = geo.verts[(i + 1) % 5];
    const A = px(a), B = px(b);
    const midM = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const nm = Math.hypot(midM[0], midM[1]) || 1;
    const q = px([midM[0] - (midM[0] / nm) * 0.95, midM[1] - (midM[1] / nm) * 0.95]);
    x.fillStyle = '#00e5ff';
    x.font = (46 * k | 0) + 'px -apple-system, Helvetica, sans-serif';
    x.fillText('TƯỜNG ' + (i + 1) + ' — ' + walls[i].wcm + ' cm', q[0], q[1]);
  });

  const cuaIdx = {};   // đếm cửa theo từng tường: cua1, cua2, cua3...
  geo.doors.forEach((d, i) => {
    const half = 0.49; // cửa rộng 98 cm
    const a = px([d.p[0] - d.t[0] * half, d.p[1] - d.t[1] * half]);
    const b = px([d.p[0] + d.t[0] * half, d.p[1] + d.t[1] * half]);
    x.strokeStyle = '#ff3b3b'; x.lineWidth = 16 * k; x.lineCap = 'butt';
    x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
    const inw = px([d.p[0] + d.n[0] * 0.42, d.p[1] + d.n[1] * 0.42]);
    x.fillStyle = '#ff8a8a';
    x.font = (34 * k | 0) + 'px -apple-system, Helvetica, sans-serif';
    // Số hiệu zone = thứ tự cửa TRÊN TƯỜNG ĐÓ (geo.doors đi lần lượt tường 1→5,
    // trái→phải). Cách cũ suy từ frac<0.5 chỉ đúng khi mỗi tường có tối đa 2 cửa.
    cuaIdx[d.wall] = (cuaIdx[d.wall] || 0) + 1;
    x.fillText('/tuong' + d.wall + '/zone/cua' + cuaIdx[d.wall], inw[0], inw[1]);
  });

  // thông tin
  x.fillStyle = '#888'; x.textAlign = 'left'; x.textBaseline = 'top';
  x.font = (40 * k | 0) + 'px -apple-system, Helvetica, sans-serif';
  x.fillText('FLOOR CALIB  ' + P.W + '×' + P.H + '   ' + (S / 100).toFixed(2) + ' px/cm   ' +
    'ngũ giác nội tiếp R=' + geo.circumR.toFixed(2) + 'm  sàn ' + geo.area.toFixed(1) + ' m²  rot=' + P.rot + '°', 40 * k, 30 * k);
  x.fillText('Kéo 4 góc surface trong MadMapper tới khi viền trắng trùng chân 5 tường; vạch đỏ = ô cửa.', 40 * k, 84 * k);

  // gửi 1 frame (lật sẵn vì ffmpeg có -vf vflip)
  const img = x.getImageData(0, 0, P.W, P.H).data;
  const out = new Uint8Array(P.W * P.H * 4);
  const rb = P.W * 4;
  for (let y = 0; y < P.H; y++) out.set(img.subarray(y * rb, y * rb + rb), (P.H - 1 - y) * rb);

  window.api.ready({ scale: S, area: geo.area, circumR: geo.circumR, vertsPx: geo.vertsPx, doorsPx: geo.doorsPx, segCount: 0, hasFloat: false });
  window.api.onGo(async () => { await window.api.frame(out); await window.api.done(); });
})();
