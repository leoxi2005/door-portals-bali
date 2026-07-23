// DOOR PORTALS — 5-wall panorama engine.
// One seamless 9335x1080 canvas spanning 5 projection walls (pentagon room).
// Orthographic camera over a scene measured in meters (x: 0..~24.6, y: 0..~2.85).
// Each wall: its own LiDAR (OSC port), its own doors, its own overlay zone.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { makeSky, makeMeadow, makeFog, makeGrass, makeDummyDoors, makeFireflies, makeGroundGlow, makePetals, makeCelestial, makeAurora, makeTrees, makeLanterns, makeButterflies, makeStars } from './environment.js';
import { makeFarTrees } from './decor.js';
import { World } from './worlds.js';
import { Door } from './door.js';
import { initDebugOverlays } from './debug-overlay.js';
import { initResPanel } from './res-panel.js';
import { AudioEngine } from './audio.js';

const cfg = await window.api.getConfig();
const FPS = cfg.output?.fps ?? 30;
const Q = cfg.quality ?? {};

// FULLY RESPONSIVE LAYOUT — everything derives from the wall list, so editing a
// wall's px width (fix a mis-measure) or the height in config.json re-scales the
// whole scene (doors, trees, flowers, per-wall NDI crops) automatically:
//   • total width  PX_W = sum of the walls' px
//   • meter scale  M_PER_PX = (wall height in cm / 100) / PX_H   (real 220 cm)
//   • each wall's metres, door positions and NDI crop all follow.
const wallsCfg = cfg.walls ?? [{ px: cfg.output?.width ?? 9336, hcm: 220, oscPort: 9001, doors: [0.5] }];
const PX_H = cfg.output?.height ?? 832;
const PX_W = wallsCfg.reduce((s, w) => s + (w.px || 0), 0) || (cfg.output?.width ?? 9336);
const M_PER_PX = ((wallsCfg[0]?.hcm ?? 220) / 100) / PX_H;

let acc = 0;
const walls = wallsCfg.map((wc, i) => {
  const wm = wc.px * M_PER_PX;
  const wall = { index: i, x0: acc, wm, px: wc.px, oscPort: wc.oscPort, doorFracs: wc.doors ?? [0.5] };
  acc += wm;
  return wall;
});
const W = acc;                 // total perimeter (m) = PX_W * M_PER_PX
const H = PX_H * M_PER_PX;      // wall height (m) = hcm / 100

// ---------------------------------------------------------------- renderer

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance',
  stencil: false
});
const renderScale = cfg.output?.renderScale ?? 1.0;
// NDI-friendly even dimensions
const evenPx = (v) => Math.max(2, Math.floor(v / 2) * 2);
renderer.setSize(evenPx(PX_W * renderScale), evenPx(PX_H * renderScale), false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---------------------------------------------------------------- scene

const scene = new THREE.Scene();
// Balanced so hero doors stay clear (~35% haze) while doors 15m deep melt
// into the mist (~70%) — real aerial perspective across the meadow.
scene.fog = new THREE.FogExp2(0x0a0d1c, 0.022);

// Long-lens perspective: camera pulled 60 m back with a narrow FOV sized so
// the frustum covers exactly [0..W]x[0..H] at the door plane (z=0). Gives real
// depth (foreshortening, converging distance) with only ~12° of edge skew.
const CAM_D = 60;
const camera = new THREE.PerspectiveCamera(
  THREE.MathUtils.radToDeg(2 * Math.atan((H / 2) / CAM_D)),
  W / H, 1, 400
);
camera.position.set(W / 2, H / 2, CAM_D);
camera.lookAt(W / 2, H / 2, 0);

scene.add(new THREE.AmbientLight(0x4a5378, 1.15));
// Moon as a BACK light: rims the doors and throws long soft shadows forward
// across the floor toward the audience.
const moon = new THREE.DirectionalLight(0xa8bcff, 1.3);
moon.position.set(W / 2 - 6, 12, -9);
moon.target.position.set(W / 2, 0, 0);
scene.add(moon.target);
moon.castShadow = true;
moon.shadow.mapSize.set(4096, 1024);
moon.shadow.camera.left = -(W / 2 + 2);
moon.shadow.camera.right = W / 2 + 2;
moon.shadow.camera.top = 10;
moon.shadow.camera.bottom = -8;
moon.shadow.camera.near = 1;
moon.shadow.camera.far = 45;
moon.shadow.bias = -0.0006;
moon.shadow.normalBias = 0.02;
scene.add(moon);

// Front fill so door faces stay readable against the backlight
const fill = new THREE.DirectionalLight(0x8fa0d8, 0.7);
fill.position.set(W / 2 + 8, 8, 20);
scene.add(fill);

// Invisible floor that only displays received shadows
const shadowCatcher = new THREE.Mesh(
  new THREE.PlaneGeometry(W * 1.1, 12),
  new THREE.ShadowMaterial({ opacity: 0.38 })
);
shadowCatcher.rotation.x = -Math.PI / 2;
shadowCatcher.position.set(W / 2, -0.01, 1.5);
shadowCatcher.receiveShadow = true;
scene.add(shadowCatcher);

const sky = makeSky(W, H);
const meadow = makeMeadow(W);
const fog = makeFog(W, H);
const grass = makeGrass(Q.grassBlades ?? 1700, W);
// Hero door x positions — dummy doors avoid standing right behind them
makeDummyDoors.heroXs = walls.flatMap(w => w.doorFracs.map(f => w.x0 + f * w.wm));
const dummies = makeDummyDoors(Q.dummyDoors ?? 26, Q.glowSlabs ?? 34, W, H);
const fireflies = makeFireflies(Q.fireflies ?? 120, W);
// a sparse, deeper layer of fireflies drifting among the far doors (few, dim)
const farFireflies = makeFireflies(Math.round((Q.fireflies ?? 120) * 0.16), W, { zMin: -11, zMax: -5, sizeScale: 0.7 });
const farTrees = makeFarTrees(W, Q.farTrees ?? 9);
const petals = makePetals(Q.petals ?? 90, W, H);
const celestial = makeCelestial(W, H);
const stars = makeStars(Q.stars ?? 240, W, H);
const aurora = makeAurora(W, H);
const trees = makeTrees(W, H);
const lanterns = makeLanterns(Q.lanterns ?? 12, W, H);
const butterflies = makeButterflies(Q.butterflies ?? 8, W);
scene.add(sky, stars, aurora, farTrees, meadow, dummies, farFireflies, grass, fireflies, petals,
  celestial, lanterns, butterflies, trees, makeGroundGlow(W), fog);

// ---------------------------------------------------------------- doors

const timing = {
  openDuration: cfg.timing?.openDuration ?? 1.2,
  overlayFadeIn: cfg.timing?.overlayFadeIn ?? 0.9,
  overlayHold: cfg.timing?.overlayHold ?? 10,
  overlayMaxHold: cfg.timing?.overlayMaxHold ?? 60,
  overlayFadeOut: cfg.timing?.overlayFadeOut ?? 1.2,
  closeDuration: cfg.timing?.closeDuration ?? 1.0,
  cooldown: cfg.timing?.cooldown ?? 1.5
};

const worldCfgs = cfg.worlds ?? [];
const doors = [];
let doorIdx = 0;
for (const wall of walls) {
  wall.doors = [];
  for (const f of wall.doorFracs) {
    const wcfg = worldCfgs[doorIdx % Math.max(worldCfgs.length, 1)] ?? { palette: 'meadow' };
    const world = new World(wcfg);
    const door = new Door(doorIdx, wall.x0 + f * wall.wm, world, timing);
    scene.add(door.group);
    doors.push(door);
    wall.doors.push(door);
    doorIdx++;
  }
  wall.activeDoor = null;
  // Stagger the attract teases so walls never sync up
  wall.nextTeaseT = 15 + wall.index * 9 + Math.random() * 10;
}
const teaseInterval = cfg.timing?.teaseInterval ?? 40; // seconds; 0 disables

// Calibration tools (press O = OSC monitor, C = touch/hit-zone overlay). DOM-only
// → never appears in the NDI feed.
const dbg = initDebugOverlays({ gl: canvas, camera, walls, doors, H, osc: cfg.osc });
// Editable resolution panel (press R) — type each wall's px, save to config.json.
initResPanel({ wallsCfg, PX_H, api: window.api });

// ---------------------------------------------------------------- audio

const audio = new AudioEngine(cfg.audio?.volume ?? 0.8);
if (cfg.audio?.enabled ?? true) audio.start();
for (const d of doors) {
  const pan = ((d.x / W) * 2 - 1) * 0.85; // stereo image follows the wall span
  d.events = {
    open: () => audio.doorOpen(pan),
    close: () => audio.doorClose(pan)
  };
}

// ---------------------------------------------------------------- post fx

const composer = new EffectComposer(renderer);
// MSAA on the composer targets — kills jagged edges (WebGL2)
if (composer.renderTarget1) composer.renderTarget1.samples = 4;
if (composer.renderTarget2) composer.renderTarget2.samples = 4;
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(Math.round(PX_W * renderScale), Math.round(PX_H * renderScale)),
  Q.bloomStrength ?? 0.5,
  Q.bloomRadius ?? 0.4,
  Q.bloomThreshold ?? 0.9
);
composer.addPass(bloom);

// Cinematic grade: gentle teal shadow lift, +saturation, animated film grain.
const gradePass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      // gentle filmic S-curve for contrast without crushing
      c.rgb = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), 0.35);
      l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      // saturation +12%
      c.rgb = mix(vec3(l), c.rgb, 1.12);
      // cinematic teal-orange: teal in shadows, warm in highlights
      c.rgb += vec3(0.004, 0.012, 0.026) * (1.0 - smoothstep(0.0, 0.38, l));
      c.rgb *= mix(vec3(1.0), vec3(1.055, 1.015, 0.94), smoothstep(0.45, 1.0, l));
      // very fine grain, barely there (kept subtle so NDI/projection stays clean)
      float g = hash(vUv * vec2(1913.0, 1087.0) + fract(uTime * 13.7)) * 2.0 - 1.0;
      c.rgb += g * 0.004;
      gl_FragColor = c;
    }
  `
});
composer.addPass(gradePass);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- input

// Touch in scene meters → wall zone → door hit-test → per-wall lock.
// Every door is independent now (each has its own portal) — no wall lock.
function touchAtMeters(xm, ym) {
  const wall = walls.find(w => xm >= w.x0 && xm < w.x0 + w.wm);
  if (!wall) return;
  const door = wall.doors.find(d => d.hitTest(xm, ym));
  if (!door) return;
  if (door.touch()) {
    wall.nextTeaseT = clock.elapsedTime + teaseInterval;
    hud.lastTouch = `wall ${wall.index + 1} / door ${door.index + 1}`;
  }
}

function triggerDoor(door) {
  door.touch();
}

// Mouse (dev): canvas px → scene meters
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  const xm = ((e.clientX - r.left) / r.width) * W;
  const ym = (1 - (e.clientY - r.top) / r.height) * H;
  dbg.logTouch(xm, ym, null);
  touchAtMeters(xm, ym);
});

// Keys 1..9 (dev), H toggles HUD
window.addEventListener('keydown', (e) => {
  const n = Number(e.key);
  if (n >= 1 && n <= doors.length) triggerDoor(doors[n - 1]);
  if (e.key === 'h') hudEl.classList.toggle('hidden');
  if (e.key === 'm') audio.toggleMute();
});

// OSC: each wall's LiDAR posts /touch x y (normalized within that wall) to its own port
const oscAddress = cfg.osc?.address ?? '/touch';
const flipY = cfg.osc?.flipY ?? false;
const normalized = cfg.osc?.normalized ?? true;

// --- Zone protocol (bridge preferred): /tuongN/zone/cuaM  <int 1|0>.
// Resolve an address → a Door: explicit map first, else the /tuong{W}/zone/cua{D}
// rule (Wth wall, Dth door). Sub-addresses (…/dwell, …/count) don't match → ignored.
const zonesMap = cfg.osc?.zones ?? {};
const zoneRuleRe = cfg.osc?.zoneRule ? new RegExp(cfg.osc.zoneRule) : null;
// Zone-calibration overlay: the bridge streams each zone's wall-local rectangle
// (/zonecal/tuongN/cuaM  fx0 fx1 [fy0 fy1]) so the Shift+M map can draw it over
// the doors — a live "does this zone line up with the door" check.
const zoneCalRe = /^\/zonecal\/tuong(\d+)\/cua(\d+)$/;
const zoneCloseOnRelease = cfg.osc?.zoneCloseOnRelease ?? false;
function resolveZoneDoor(address) {
  if (zonesMap[address]) return doors[zonesMap[address] - 1] || null;
  if (zoneRuleRe) {
    const m = address.match(zoneRuleRe);
    if (m) {
      const w = walls[Number(m[1]) - 1];
      if (w) return w.doors[Number(m[2]) - 1] || null;
    }
  }
  return null;
}

window.api.onOsc((msg) => {
  hud.lastOsc = `:${msg.port} ${msg.address} ${msg.args.map(a => typeof a === 'number' ? a.toFixed(3) : a).join(' ')}`;
  dbg.logOsc(msg); // OSC monitor sees EVERY packet, even on the wrong address

  // Zone-calibration geometry from the bridge → draw it on the Shift+M map.
  const zc = msg.address.match(zoneCalRe);
  if (zc) {
    const a = msg.args.map(Number);
    dbg.setBridgeZone(Number(zc[1]), Number(zc[2]), a[0] ?? 0, a[1] ?? 1, a[2], a[3]);
    return;
  }

  // Zone touch → open on 1, close on 0 (if zoneCloseOnRelease; else auto-plays out).
  const zoneDoor = resolveZoneDoor(msg.address);
  if (zoneDoor) {
    const on = Number(msg.args[0] ?? 0) >= 1;
    zoneDoor.held = on;                    // hold-to-view: stays open while touched
    if (on) zoneDoor.setOpen(true);
    else if (zoneCloseOnRelease) zoneDoor.setOpen(false);
    dbg.flashZone(zoneDoor);
    dbg.noteTrigger(zoneDoor, msg.address, on);
    hud.lastTouch = `${msg.address}=${on ? 1 : 0} → D${zoneDoor.index + 1}`;
    return;
  }

  const wall = walls.find(w => w.oscPort === msg.port);
  if (!wall) return;
  if (msg.address === oscAddress && msg.args.length >= 2) {
    let [x, y] = msg.args;
    if (!normalized) { x /= wall.px; y /= PX_H; }
    const ym = flipY ? y * H : (1 - y) * H;
    const xm = wall.x0 + x * wall.wm;
    dbg.logTouch(xm, ym, msg.port);
    touchAtMeters(xm, ym);
  } else if (/^\/door\/[0-9]+$/.test(msg.address)) {
    const idx = Number(msg.address.split('/')[2]) - 1;
    if (doors[idx]) triggerDoor(doors[idx]);
  }
});

// ---------------------------------------------------------------- NDI out

const gl = renderer.getContext();
const dw = renderer.domElement.width;
const dh = renderer.domElement.height;
canvas.style.aspectRatio = `${PX_W} / ${PX_H}`; // preview window matches output ratio
const pixelBuf = new Uint8Array(dw * dh * 4);
const flippedBuf = new Uint8Array(dw * dh * 4);
let ndiRunning = false;
let ndiError = null;

// Per-wall NDI crops: the render is the 5 walls side by side (one continuous
// world). Slice each wall's exact column range into its OWN NDI stream, at that
// wall's true aspect ratio → the mapper warps each onto its physical wall.
{
  let acc = 0;
  walls.forEach((w, i) => {
    const last = i === walls.length - 1;
    let bnd = last ? dw : Math.round(((w.x0 + w.wm) / W) * dw);
    bnd -= bnd % 2;                          // even width for NDI
    w.cropX0 = acc;
    w.cropW = Math.max(2, bnd - acc);
    w.ndiName = `DOOR-WALL-${i + 1}`;
    w.ndiBuf = new Uint8Array(w.cropW * dh * 4);
    acc = bnd;
  });
}

const pbo = gl.createBuffer();
gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
gl.bufferData(gl.PIXEL_PACK_BUFFER, dw * dh * 4, gl.STREAM_READ);
gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
let pendingFence = null;

async function startNdi() {
  if (!(cfg.ndi?.enabled ?? true)) return;
  let anyOk = false;
  for (const w of walls) {
    const res = await window.api.ndi.start({ name: w.ndiName, width: w.cropW, height: dh, fps: FPS });
    if (res.ok) anyOk = true;
    else { ndiError = res.error; console.warn('[ndi]', w.ndiName, res.error); }
  }
  ndiRunning = anyOk;
}
startNdi();

function captureStart() {
  if (pendingFence) return;
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
  gl.readPixels(0, 0, dw, dh, gl.RGBA, gl.UNSIGNED_BYTE, 0);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  pendingFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
}

function captureCollect() {
  if (!pendingFence) return;
  const status = gl.clientWaitSync(pendingFence, 0, 0);
  if (status !== gl.ALREADY_SIGNALED && status !== gl.CONDITION_SATISFIED) return;
  gl.deleteSync(pendingFence);
  pendingFence = null;

  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
  gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixelBuf);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

  const srcRow = dw * 4;
  for (let y = 0; y < dh; y++) {
    flippedBuf.set(pixelBuf.subarray(y * srcRow, y * srcRow + srcRow), (dh - 1 - y) * srcRow);
  }
  // slice each wall's columns into its own tightly-packed buffer → its NDI stream
  for (const w of walls) {
    const crow = w.cropW * 4, srcX = w.cropX0 * 4, buf = w.ndiBuf;
    for (let y = 0; y < dh; y++) {
      const s = y * srcRow + srcX;
      buf.set(flippedBuf.subarray(s, s + crow), y * crow);
    }
    window.api.ndi.frame({ name: w.ndiName, width: w.cropW, height: dh, fps: FPS }, buf);
  }
}

// ---------------------------------------------------------------- HUD

const hudEl = document.getElementById('hud');
const hud = { fps: 0, lastOsc: '—', lastTouch: '—' };
setInterval(() => {
  const states = walls.map(w =>
    `W${w.index + 1}[${w.doors.map(d => d.state[0]).join('')}]`
  ).join(' ');
  hudEl.textContent =
    `DOOR PORTALS  ${PX_W}x${PX_H}@${FPS}  render:${dw}x${dh}  fps:${hud.fps.toFixed(0)}\n` +
    `NDI ${ndiRunning ? 'ON 5×[' + walls.map(w => w.cropW + 'x' + dh).join(' ') + ']' : 'OFF' + (ndiError ? ' (' + ndiError + ')' : '')}\n` +
    `OSC in :${cfg.osc?.port ?? '—'} (zones) + walls:${walls.map(w => w.oscPort).join(',')}\n` +
    `osc-in: ${hud.lastOsc}\n` +
    `touch:  ${hud.lastTouch}   ${states}  (i=idle o=opening v=overlay c=closing/cooldown)\n` +
    `[g]=HƯỚNG DẪN  [o]=OSC-monitor  [Shift+M]=wall-map  [r]=độ-phân-giải  ·  [1..${doors.length}]=doors  [h]=hud  [m]=mute`;
}, 250);

// ---------------------------------------------------------------- main loop

const clock = new THREE.Clock();
let ndiAccum = 0;
let fpsAccum = 0, fpsFrames = 0;
const maxFps = Q.maxFps ?? 60;
const minFrameTime = 1 / maxFps - 0.0015;
let lastFrameT = 0;

function frame() {
  requestAnimationFrame(frame);
  const nowT = performance.now() / 1000;
  if (nowT - lastFrameT < minFrameTime) return;
  lastFrameT = nowT;

  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;

  fpsAccum += dt; fpsFrames++;
  if (fpsAccum >= 0.5) { hud.fps = fpsFrames / fpsAccum; fpsAccum = 0; fpsFrames = 0; }

  captureCollect();

  gradePass.uniforms.uTime.value = t;
  sky.update(t);
  meadow.update(t);
  fog.update(t);
  grass.update(t);
  dummies.update(t);
  farTrees.update(t);
  fireflies.update(t);
  farFireflies.update(t);
  petals.update(t);
  celestial.update(t);
  stars.update(t);
  aurora.update(t);
  trees.update(t);
  lanterns.update(t);
  butterflies.update(t);

  for (const d of doors) {
    d.world.update(t);
    d.update(dt, t);
  }
  for (const wall of walls) {
    // Attract: quiet wall → one random door cracks open invitingly
    if (teaseInterval > 0 && t >= wall.nextTeaseT) {
      wall.nextTeaseT = t + teaseInterval * (0.75 + Math.random() * 0.5);
      if (!wall.doors.some(d => d.busy)) {
        wall.doors[Math.floor(Math.random() * wall.doors.length)].tease();
      }
    }
  }

  composer.render();

  if (ndiRunning) {
    ndiAccum += dt;
    const interval = 1 / FPS;
    if (ndiAccum >= interval) {
      ndiAccum %= interval;
      captureStart();
    }
  }
}
frame();
