/* WebGL2 renderer — dựng scene sàn, xuất frame ra ffmpeg qua IPC. */
(function () {
  'use strict';

  const P = window.FLOOR_PARAMS;
  const S = window.FloorShaders;
  const log = (...a) => { console.log('[floor]', ...a); };

  const canvas = document.getElementById('c');
  canvas.width = P.W; canvas.height = P.H;
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false, alpha: false });
  if (!gl) throw new Error('WebGL2 không khả dụng');
  const hasFloat = !!gl.getExtension('EXT_color_buffer_float');
  const HDR = hasFloat ? gl.RGBA16F : gl.RGBA8;
  const HDR_T = hasFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

  /* ---------- helpers ---------- */
  function sh(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(s);
      const lines = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
      throw new Error('Shader lỗi: ' + info + '\n' + lines.slice(0, 4000));
    }
    return s;
  }
  function prog(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link lỗi: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  function fbo(w, h, internal, type) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex: t, fb: f, w, h };
  }

  /* ---------- hình học ---------- */
  const geo = window.FloorGeo.buildGeometry(P.walls, { W: P.W, H: P.H, rotDeg: P.rot, fit: P.fit, flip: P.flip });
  window.__geo = geo;
  log('ngũ giác: R=' + geo.circumR.toFixed(3) + 'm  area=' + geo.area.toFixed(2) + 'm²  ' +
      geo.scale.toFixed(1) + ' px/m (' + (geo.scale / 100).toFixed(2) + ' px/cm)');

  // pháp tuyến ngoài + offset cho SDF (mét)
  const NN = [], DD = [];
  {
    let s2 = 0;
    for (let i = 0; i < 5; i++) { const a = geo.verts[i], b = geo.verts[(i + 1) % 5]; s2 += a[0] * b[1] - b[0] * a[1]; }
    const orient = s2 > 0 ? 1 : -1;
    for (let i = 0; i < 5; i++) {
      const a = geo.verts[i], b = geo.verts[(i + 1) % 5];
      const ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey);
      const nx = (orient * ey) / L, ny = (-orient * ex) / L;   // hướng ra ngoài
      NN.push(nx, ny); DD.push(nx * a[0] + ny * a[1]);
    }
  }

  /* ---------- texture rễ ---------- */
  const bake = window.FloorRoots.bakeRoots(geo, { seed: P.seed, poolR: P.poolR });
  log('rễ: ' + bake.segCount + ' đoạn');
  const rootTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, rootTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, bake.width, bake.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, bake.data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  /* ---------- đom đóm ---------- */
  const rnd = window.FloorRoots.mulberry32(P.seed ^ 0x5eed);
  function insideM(p) {
    for (let i = 0; i < 5; i++) if (p[0] * NN[i * 2] + p[1] * NN[i * 2 + 1] - DD[i] > -0.35) return false;
    return true;
  }
  const NF = P.flies;
  const A0 = new Float32Array(NF * 4), A1 = new Float32Array(NF * 4), A2 = new Float32Array(NF * 4);
  {
    const R = geo.circumR;
    let i = 0, guard = 0;
    while (i < NF && guard++ < NF * 200) {
      const p = [(rnd() * 2 - 1) * R, (rnd() * 2 - 1) * R];
      if (!insideM(p)) continue;
      const a1 = 0.10 + rnd() * 0.45, a2 = 0.04 + rnd() * 0.20;
      A0.set([p[0], p[1], a1, a2], i * 4);
      A1.set([Math.max(1, Math.round(rnd() * 3)), Math.max(1, Math.round(rnd() * 6)), rnd(), rnd()], i * 4);
      const size = (P.W / 3840) * (9 + rnd() * 20);
      A2.set([size, 0.55 + rnd() * 0.85, rnd(), rnd()], i * 4);
      i++;
    }
  }
  function buf(loc, data) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
  }
  const vaoFly = gl.createVertexArray();
  gl.bindVertexArray(vaoFly); buf(0, A0); buf(1, A1); buf(2, A2); gl.bindVertexArray(null);

  /* ---------- programs + fbo ---------- */
  const pScene = prog(S.VS_QUAD, S.FS_SCENE);
  const pFly = prog(S.VS_FLY, S.FS_FLY);
  const pBright = prog(S.VS_QUAD, S.FS_BRIGHT);
  const pBlur = prog(S.VS_QUAD, S.FS_BLUR);
  const pComp = prog(S.VS_QUAD, S.FS_COMP);

  const bw = Math.max(2, Math.floor(P.W / 4)), bh = Math.max(2, Math.floor(P.H / 4));
  const bw2 = Math.max(2, Math.floor(P.W / 12)), bh2 = Math.max(2, Math.floor(P.H / 12));
  const fScene = fbo(P.W, P.H, HDR, HDR_T);
  const fB1 = fbo(bw, bh, HDR, HDR_T), fB2 = fbo(bw, bh, HDR, HDR_T);
  const fC1 = fbo(bw2, bh2, HDR, HDR_T), fC2 = fbo(bw2, bh2, HDR, HDR_T);
  const fOut = fbo(P.W, P.H, gl.RGBA8, gl.UNSIGNED_BYTE);
  const vaoQuad = gl.createVertexArray();

  // 9 chân cửa (mét) cho đèn cửa
  const DOORM = new Float32Array(18), DOORPH = new Float32Array(9);
  geo.doors.forEach((d, i) => {
    if (i >= 9) return;
    DOORM[i * 2] = d.p[0] + d.n[0] * 0.30;
    DOORM[i * 2 + 1] = d.p[1] + d.n[1] * 0.30;
    DOORPH[i] = (i * 0.37) % 1;
  });

  function setCommon(o) {
    gl.uniform2f(o.u['uRes'], P.W, P.H);
    gl.uniform1f(o.u['uScale'], geo.scale);
    if (o.u['uN[0]']) gl.uniform2fv(o.u['uN[0]'], new Float32Array(NN));
    if (o.u['uD[0]']) gl.uniform1fv(o.u['uD[0]'], new Float32Array(DD));
  }
  function drawQuad() { gl.bindVertexArray(vaoQuad); gl.drawArrays(gl.TRIANGLES, 0, 3); }

  function renderFrame(t) {
    // --- scene ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, fScene.fb);
    gl.viewport(0, 0, P.W, P.H);
    gl.disable(gl.BLEND);
    gl.useProgram(pScene.p); setCommon(pScene);
    gl.uniform1f(pScene.u['uT'], t);
    gl.uniform1f(pScene.u['uPoolR'], P.poolR);
    gl.uniform1f(pScene.u['uEmit'], P.emit);
    if (pScene.u['uDoor[0]']) gl.uniform2fv(pScene.u['uDoor[0]'], DOORM);
    if (pScene.u['uDoorPh[0]']) gl.uniform1fv(pScene.u['uDoorPh[0]'], DOORPH);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rootTex);
    gl.uniform1i(pScene.u['uRoot'], 0);
    drawQuad();

    // --- đom đóm (cộng sáng) ---
    gl.useProgram(pFly.p);
    gl.uniform2f(pFly.u['uRes'], P.W, P.H);
    gl.uniform1f(pFly.u['uScale'], geo.scale);
    gl.uniform1f(pFly.u['uT'], t);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(vaoFly); gl.drawArrays(gl.POINTS, 0, NF);
    gl.bindVertexArray(null); gl.disable(gl.BLEND);

    // --- bloom ---
    gl.useProgram(pBright.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fB1.fb); gl.viewport(0, 0, bw, bh);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fScene.tex);
    gl.uniform1i(pBright.u['uTex'], 0); gl.uniform1f(pBright.u['uThresh'], P.bloomThresh);
    drawQuad();

    const blur = (src, dst, w, h, dx, dy) => {
      gl.useProgram(pBlur.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, w, h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(pBlur.u['uTex'], 0); gl.uniform2f(pBlur.u['uDir'], dx / w, dy / h);
      drawQuad();
    };
    blur(fB1, fB2, bw, bh, 1, 0); blur(fB2, fB1, bw, bh, 0, 1);
    // tầng rộng hơn
    gl.useProgram(pBright.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fC1.fb); gl.viewport(0, 0, bw2, bh2);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fB1.tex);
    gl.uniform1i(pBright.u['uTex'], 0); gl.uniform1f(pBright.u['uThresh'], 0.0);
    drawQuad();
    blur(fC1, fC2, bw2, bh2, 1, 0); blur(fC2, fC1, bw2, bh2, 0, 1);

    // --- composite ---
    gl.useProgram(pComp.p); setCommon(pComp);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fOut.fb); gl.viewport(0, 0, P.W, P.H);
    gl.uniform1f(pComp.u['uT'], t);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fScene.tex); gl.uniform1i(pComp.u['uScene'], 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fB1.tex); gl.uniform1i(pComp.u['uBloomA'], 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, fC1.tex); gl.uniform1i(pComp.u['uBloomB'], 2);
    gl.uniform1f(pComp.u['uBloom'], P.bloom);
    gl.uniform1f(pComp.u['uBleed'], P.bleed);
    gl.uniform1f(pComp.u['uGrain'], P.grain);
    gl.uniform1f(pComp.u['uExposure'], P.exposure);
    drawQuad();
  }

  const pix = new Uint8Array(P.W * P.H * 4);
  function grab() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fOut.fb);
    gl.readPixels(0, 0, P.W, P.H, gl.RGBA, gl.UNSIGNED_BYTE, pix);
    return pix;
  }

  /* ---------- vòng xuất ---------- */
  async function run() {
    if (P.mode === 'still') {
      const ts = P.stillTimes;
      for (const t of ts) { renderFrame(t); await window.api.frame(grab().slice()); }
      await window.api.done();
      return;
    }
    const N = Math.round(P.dur * P.fps);
    let last = Date.now();
    for (let i = 0; i < N; i++) {
      renderFrame(i / N);                       // 0 → gần 1, không lặp frame đầu
      await window.api.frame(grab().slice());
      if (i % 30 === 0 || i === N - 1) {
        const now = Date.now(), dt = (now - last) / 1000; last = now;
        window.api.log(`frame ${i + 1}/${N}  ${(30 / Math.max(dt, 1e-6)).toFixed(1)} fps`);
      }
    }
    await window.api.done();
  }

  window.api.ready({
    scale: geo.scale, area: geo.area, circumR: geo.circumR,
    vertsPx: geo.vertsPx, doorsPx: geo.doorsPx, segCount: bake.segCount, hasFloat,
  });
  window.api.onGo(() => { run().catch((e) => window.api.fail(String(e && e.stack || e))); });
})();
