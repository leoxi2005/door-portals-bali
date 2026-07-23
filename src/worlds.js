// "Worlds" — what lives behind each door.
// Prefers a video file (assets/worlds/doorN.mp4). If the file is missing,
// falls back to a procedural animated shader world with a per-door palette.
// Each world provides two materials that share the same visual:
//   - portal material  : shown inside the doorway
//   - overlay material : fullscreen quad, faded in when the door fully opens

import * as THREE from 'three';

// ---------------------------------------------------------------- video pool
// Every time a door opens it pulls a RANDOM clip from this shared pool, so no
// one can predict which glimpse of the dream-life will appear next. All clips
// are preloaded once and paused; opening a door just grabs a free one and plays.
const PORTAL_AR = 1.02 / 1.82; // doorway portal aspect ≈ 0.56

function coverFit(tex, video) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  const va = (video.videoWidth || 9) / (video.videoHeight || 16);
  if (va > PORTAL_AR) { const rx = PORTAL_AR / va; tex.repeat.set(rx, 1); tex.offset.set((1 - rx) / 2, 0); }
  else { const ry = va / PORTAL_AR; tex.repeat.set(1, ry); tex.offset.set(0, (1 - ry) / 2); }
}

const POOL_COUNT = 16;
let POOL = null;
function ensurePool() {
  if (POOL) return POOL;
  POOL = [];
  for (let i = 1; i <= POOL_COUNT; i++) {
    const src = `assets/worlds/pool/pool${String(i).padStart(2, '0')}.mp4`;
    const video = document.createElement('video');
    video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
    video.src = src;
    const entry = { video, texture: null, ready: false, inUse: false };
    video.addEventListener('loadeddata', () => {
      const tex = new THREE.VideoTexture(video);
      coverFit(tex, video);
      entry.texture = tex; entry.ready = true;
    }, { once: true });
    video.addEventListener('error', () => console.log(`[pool] missing ${src}`), { once: true });
    POOL.push(entry);
  }
  return POOL;
}
// grab a random ready clip, preferring one not already showing behind another door
function acquireClip() {
  const p = ensurePool().filter(e => e.ready);
  if (!p.length) return null;
  const free = p.filter(e => !e.inUse);
  const bag = free.length ? free : p;
  const e = bag[Math.floor(Math.random() * bag.length)];
  e.inUse = true;
  return e;
}
function releaseClip(e) {
  if (!e) return;
  try { e.video.pause(); e.video.currentTime = 0; } catch (_) {}
  e.inUse = false;
}

const PALETTES = {
  meadow: {
    sky: [0.35, 0.62, 0.95], horizon: [0.80, 0.92, 1.0],
    ground: [0.32, 0.62, 0.22], sun: [1.0, 1.0, 0.92]
  },
  sunset: {
    sky: [0.45, 0.16, 0.38], horizon: [1.0, 0.55, 0.28],
    ground: [0.22, 0.10, 0.18], sun: [1.0, 0.75, 0.45]
  },
  aurora: {
    sky: [0.02, 0.05, 0.12], horizon: [0.08, 0.35, 0.35],
    ground: [0.05, 0.10, 0.12], sun: [0.35, 1.0, 0.7]
  },
  underwater: {
    sky: [0.02, 0.25, 0.38], horizon: [0.10, 0.55, 0.60],
    ground: [0.02, 0.12, 0.18], sun: [0.65, 0.95, 1.0]
  },
  sakura: {
    sky: [0.55, 0.35, 0.45], horizon: [1.0, 0.72, 0.78],
    ground: [0.35, 0.18, 0.24], sun: [1.0, 0.9, 0.8]
  },
  snow: {
    sky: [0.30, 0.45, 0.70], horizon: [0.95, 0.85, 0.75],
    ground: [0.75, 0.80, 0.88], sun: [1.0, 0.9, 0.7]
  },
  desert: {
    sky: [0.04, 0.05, 0.15], horizon: [0.75, 0.55, 0.30],
    ground: [0.35, 0.24, 0.12], sun: [1.0, 0.85, 0.55]
  },
  jungle: {
    sky: [0.10, 0.30, 0.20], horizon: [0.45, 0.75, 0.50],
    ground: [0.06, 0.18, 0.10], sun: [0.9, 1.0, 0.7]
  },
  cosmos: {
    sky: [0.05, 0.02, 0.12], horizon: [0.45, 0.15, 0.55],
    ground: [0.08, 0.04, 0.14], sun: [0.55, 0.85, 1.0]
  }
};

const WORLD_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const WORLD_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uSky, uHorizon, uGround, uSun;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + 11.0; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float horizonY = 0.42;

    vec3 col;
    if (uv.y > horizonY) {
      // Sky with drifting clouds
      float h = (uv.y - horizonY) / (1.0 - horizonY);
      col = mix(uHorizon, uSky, smoothstep(0.0, 0.85, h));
      float c = fbm(uv * vec2(4.0, 6.0) + vec2(uTime * 0.05, 0.0));
      float clouds = smoothstep(0.5, 0.85, c);
      col = mix(col, vec3(1.0), clouds * 0.55 * (0.4 + 0.6 * h));
      // Sun / glow orb
      vec2 sunPos = vec2(0.65, 0.78);
      float sd = length((uv - sunPos) * vec2(1.0, 1.4));
      col += uSun * smoothstep(0.35, 0.0, sd) * 0.9;
      // Aurora-style ribbons riding on the sky color
      float rib = fbm(vec2(uv.x * 3.0 + uTime * 0.1, uv.y * 8.0 - uTime * 0.06));
      col += uSun * smoothstep(0.6, 0.95, rib) * 0.25;
    } else {
      // Rolling ground with wind-shimmer
      float g = uv.y / horizonY;
      col = mix(uGround * 0.35, uGround, smoothstep(0.0, 1.0, g));
      float field = fbm(uv * vec2(14.0, 40.0) + vec2(uTime * 0.25, 0.0));
      col *= 0.8 + 0.4 * field;
      // Light path leading to the horizon
      float path = smoothstep(0.22, 0.0, abs(uv.x - 0.5) * (0.4 + g * 1.6));
      col += uHorizon * path * (1.0 - g) * 0.35;
    }

    // Soft vignette + glow near the horizon line
    col += uHorizon * smoothstep(0.12, 0.0, abs(uv.y - horizonY)) * 0.4;
    float vig = smoothstep(1.25, 0.45, length(uv - 0.5));
    col *= 0.55 + 0.45 * vig;

    gl_FragColor = vec4(col, uOpacity);
  }
`;

function makeProceduralMaterial(paletteName) {
  const pal = PALETTES[paletteName] || PALETTES.meadow;
  return new THREE.ShaderMaterial({
    vertexShader: WORLD_VERT,
    fragmentShader: WORLD_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uSky: { value: new THREE.Vector3(...pal.sky) },
      uHorizon: { value: new THREE.Vector3(...pal.horizon) },
      uGround: { value: new THREE.Vector3(...pal.ground) },
      uSun: { value: new THREE.Vector3(...pal.sun) }
    },
    transparent: false,
    depthWrite: true,
    fog: false
  });
}

export class World {
  constructor(cfg) {
    this.palette = cfg.palette || 'meadow';
    this.mode = 'procedural';
    this.activeEntry = null;

    // Shown before the first open (hidden behind the closed door anyway).
    this.portalMaterial = makeProceduralMaterial(this.palette);
    this.overlayMaterial = makeProceduralMaterial(this.palette);
    this.overlayMaterial.uniforms.uOpacity.value = 0;

    // Carries whichever random clip this door is currently showing.
    this.videoMat = new THREE.MeshBasicMaterial({ toneMapped: true, fog: false });

    ensurePool(); // begin preloading the shared clip pool
  }

  // Open → draw a fresh random clip from the pool and show it.
  play() {
    const e = acquireClip();
    if (!e) return; // pool not ready yet — keep the procedural fallback for now
    this.activeEntry = e;
    this.videoMat.map = e.texture;
    this.videoMat.needsUpdate = true;
    this.portalMaterial = this.videoMat;
    this.mode = 'video';
    if (this.onMaterialsChanged) this.onMaterialsChanged();
    e.video.currentTime = 0;
    e.video.play().catch(() => {});
  }

  // Close → release the clip back to the pool for another door to reuse.
  pause() {
    releaseClip(this.activeEntry);
    this.activeEntry = null;
  }

  setOverlayOpacity(o) {
    if (this.overlayMaterial.uniforms) {
      this.overlayMaterial.uniforms.uOpacity.value = o;
    } else {
      this.overlayMaterial.opacity = o;
    }
  }

  update(t) {
    if (this.portalMaterial.uniforms) this.portalMaterial.uniforms.uTime.value = t;
    if (this.overlayMaterial.uniforms) this.overlayMaterial.uniforms.uTime.value = t;
  }

  // Accent color used for the door's light spill
  accentColor() {
    const pal = PALETTES[this.palette] || PALETTES.meadow;
    return new THREE.Color(pal.horizon[0], pal.horizon[1], pal.horizon[2]);
  }
}
