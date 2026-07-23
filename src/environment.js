// Environment layers for the 5-wall panorama (orthographic, meters).
// x: 0..W (left edge of wall 1 → right edge of wall 5), y: 0..H (floor → top).
// Everything is either native-resolution 3D or a high-res tiled AI texture —
// nothing is a single stretched plate, so nothing goes soft at 9335 px.

import * as THREE from 'three';

const texLoader = new THREE.TextureLoader();
export function loadTex(path) {
  const t = texLoader.load(path);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------- sky

// 2K sky texture, mirrored-repeat so it tiles seamlessly across ~25 m.
export function makeSky(W, H) {
  // Sized for the perspective frustum at z=-30 (1.5x wider than the door
  // plane) plus margin.
  const SKY_SCALE = 1.65;
  const tex = loadTex('assets/textures/sky-pano.png');
  tex.wrapS = THREE.MirroredRepeatWrapping;
  const tileW = H * SKY_SCALE * (21 / 9); // source aspect
  tex.repeat.x = (W * SKY_SCALE) / tileW;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(W * SKY_SCALE, H * SKY_SCALE),
    new THREE.MeshBasicMaterial({ map: tex, depthWrite: false, fog: false })
  );
  mesh.position.set(W / 2, H / 2, -30);
  mesh.renderOrder = -10;
  mesh.update = (t) => { tex.offset.x = (t * 0.008) % 2; };
  return mesh;
}

// Distant moonlit meadow hills strip along the bottom, mirrored-repeat.
export function makeMeadow(W) {
  const STRIP_H = 1.35;
  const STRIP_SCALE = 1.5; // covers the perspective frustum at z=-25
  const tex = loadTex('assets/textures/meadow-strip.png');
  tex.wrapS = THREE.MirroredRepeatWrapping;
  const tileW = STRIP_H * (21 / 9) * 2.0; // stretch tiles wide — it's hazy hills
  tex.repeat.x = (W * STRIP_SCALE) / tileW;

  // Additive: the image's black fades to nothing, only the moonlit mist adds.
  // Extra shader fade at the top/bottom of the strip so no rectangle edge can
  // ever show, even where the source texture isn't perfectly black.
  const mat = new THREE.MeshBasicMaterial({
    map: tex, depthWrite: false, fog: false,
    transparent: true, blending: THREE.AdditiveBlending, opacity: 0.85
  });
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
       diffuseColor.rgb *= smoothstep(1.0, 0.72, vUv.y) * smoothstep(0.0, 0.06, vUv.y);`
    );
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W * STRIP_SCALE, STRIP_H), mat);
  // Dropped a notch so its top edge sits below the mountain feet, not over them.
  mesh.position.set(W / 2, STRIP_H / 2 - 0.22, -25);
  mesh.renderOrder = -9;
  mesh.update = (t) => { tex.offset.x = (t * 0.0055) % 2; };
  return mesh;
}

// ---------------------------------------------------------------- fog

// Procedural fbm ground fog — full-width, no texture, no edges, loops by
// construction (continuous noise field drifting forever).
const FOG_VERT = /* glsl */`
  varying vec2 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xy;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FOG_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vWorld;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uSpeed;
  uniform float uScale;
  uniform float uTop;
  uniform vec3 uColor;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + 13.0; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 p = vec2(vWorld.x * uScale + uTime * uSpeed, vWorld.y * uScale * 2.2 - uTime * 0.015);
    float n = fbm(p + fbm(p * 0.6) * 0.7);
    float heightMask = 1.0 - smoothstep(0.05, uTop, vWorld.y);
    float a = uOpacity * heightMask * smoothstep(0.32, 0.85, n);
    gl_FragColor = vec4(uColor, a);
  }
`;

export function makeFog(W, H) {
  const group = new THREE.Group();
  const layers = [
    { z: -4, opacity: 0.42, speed: 0.034, scale: 0.55, top: 1.15, color: [0.62, 0.66, 0.78] },
    { z: 2.5, opacity: 0.20, speed: -0.05, scale: 0.85, top: 0.85, color: [0.55, 0.58, 0.72] }
  ];
  const mats = [];
  for (const L of layers) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: FOG_VERT,
      fragmentShader: FOG_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: L.opacity },
        uSpeed: { value: L.speed },
        uScale: { value: L.scale },
        uTop: { value: L.top },
        uColor: { value: new THREE.Vector3(...L.color) }
      },
      transparent: true,
      depthWrite: false
    });
    mats.push(mat);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.15, H * 1.15), mat);
    mesh.position.set(W / 2, H / 2, L.z);
    group.add(mesh);
  }
  group.update = (t) => { for (const m of mats) m.uniforms.uTime.value = t; };
  return group;
}

// ---------------------------------------------------------------- grass

function swayInjector(uniforms) {
  return (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       {
         #ifdef USE_INSTANCING
           vec4 base = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
         #else
           vec4 base = vec4(0.0);
         #endif
         float bend = pow(uv.y, 2.0);
         float sway = sin(uTime * 1.3 + base.x * 1.7 + base.z * 2.3) * 0.05
                    + sin(uTime * 2.7 + base.x * 3.1) * 0.02;
         transformed.x += sway * bend;
         transformed.z += cos(uTime * 1.0 + base.x * 2.2) * 0.02 * bend;
       }`
    );
  };
}

// Lush continuous meadow foreground: two overlapping AI grass-bed strips
// (mirrored-repeat across all five walls, soft alpha, waving gently) with a
// few sparse clump billboards breaking the repetition.
export function makeGrass(count, W) {
  const group = new THREE.Group();
  const uniforms = { uTime: { value: 0 } };

  // --- continuous beds
  const beds = [
    // far bed: shorter, lighter, behind the doors
    { path: 'assets/textures/grass-bed-2.png', h: 0.62, y: -0.03, z: -1.9, tint: 0xbfc6da, tiles: 3.4, amp: 0.018 },
    // near bed: taller, darker, in front of the doors
    { path: 'assets/textures/grass-bed-1.png', h: 0.95, y: -0.10, z: 2.6, tint: 0xffffff, tiles: 2.6, amp: 0.03 }
  ];
  for (const b of beds) {
    const tex = loadTex(b.path);
    tex.wrapS = THREE.MirroredRepeatWrapping;
    tex.repeat.x = b.tiles;
    // Self-lit: the bed textures are authored pre-lit ("luminous moonlight"),
    // so show them as-is instead of letting the dim night lights crush them.
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      color: b.tint,
      fog: true
    });
    const amp = b.amp;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         {
           float bend = pow(uv.y, 1.6);
           transformed.x += (sin(uTime * 1.1 + position.x * 0.9) * ${amp.toFixed(3)}
                          + sin(uTime * 2.3 + position.x * 2.1) * ${(amp * 0.4).toFixed(3)}) * bend;
         }`
      );
    };
    const geo = new THREE.PlaneGeometry(W * 1.02, b.h, 96, 1);
    geo.translate(0, b.h / 2, 0);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(W / 2, b.y, b.z);
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  // --- dense clump rows (the clump cutouts carry the meadow now)
  const cards = Math.max(60, Math.round(count / 7));
  const variants = [
    { path: 'assets/textures/grass-1.png', aspect: 1.0, share: 0.45 },
    { path: 'assets/textures/grass-2.png', aspect: 1.49, share: 0.55 }
  ];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (const v of variants) {
    const tex = loadTex(v.path);
    // OPAQUE alpha-tested (writes depth → firmly grounded, never floats). A high
    // cutoff drops the dark semi-transparent fringe entirely, and alphaToCoverage
    // + the composer's MSAA smooth the remaining edge (no jaggies).
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      alphaTest: 0.5,
      alphaToCoverage: true,
      side: THREE.DoubleSide,
      color: 0xd6e0c8,
      fog: true
    });
    mat.onBeforeCompile = swayInjector(uniforms);
    const geo = new THREE.PlaneGeometry(v.aspect, 1.0);
    geo.translate(0, 0.44, 0);
    const n = Math.round(cards * v.share);
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    for (let i = 0; i < n; i++) {
      // Three depth rows → a full layered meadow band
      const row = Math.random();
      let z, y, hBase;
      if (row < 0.4) { z = 2.6 + Math.random() * 0.9; y = -0.12; hBase = 0.55; }
      else if (row < 0.75) { z = 0.4 + Math.random() * 0.9; y = -0.07; hBase = 0.45; }
      else { z = -2.3 + Math.random() * 0.9; y = -0.04; hBase = 0.36; }
      p.set(Math.random() * W, y, z);
      e.set(0, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.06);
      q.setFromEuler(e);
      const h = hBase + Math.random() * 0.35;
      s.set(h * (Math.random() < 0.5 ? -1 : 1), h, 1);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  group.update = (t) => { uniforms.uTime.value = t; };
  return group;
}

// ---------------------------------------------------------------- floating doors

// AI-rendered glowing doors (photoreal, halo baked in, black background) as
// additive billboards. Each door is its own little group with a CLOSED and an
// OPEN face; every once in a while one crossfades open (light blooming out)
// or eases shut again. Size/brightness scale with depth for real parallax.
export function makeDummyDoors(countWood, countGlow, W, H) {
  const group = new THREE.Group();
  const count = countWood + countGlow;

  // Alpha-cutout doors (solid, clearly door-shaped against bright clouds) +
  // an additive halo that blooms only while a door is open.
  const texClosed = loadTex('assets/textures/door-cut-2.png');
  const texAjar = loadTex('assets/textures/door-cut-1.png');
  const texOpen = loadTex('assets/textures/door-cut-3.png');
  const texHalo = loadTex('assets/textures/door-float-3.png');

  function facePlane(tex, opacity, tint, additive = false) {
    return new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 1.0),
      new THREE.MeshBasicMaterial({
        map: tex,
        color: tint,
        transparent: true,
        opacity,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false,
        fog: !additive // scene fog melts distant doors into the mist
      })
    );
  }

  const doors = [];
  const doorXs = makeDummyDoors.heroXs ?? [];

  // Ordered depth rows (like a stage backdrop): near row of larger doors
  // evenly spaced, far row smaller and staggered between them. Random enough
  // to feel alive, rhythmic enough to read clean.
  const rows = [
    { z: -4.5, size: 1.18, jitter: 0.35, share: 0.55 },
    { z: -9, size: 0.78, jitter: 0.25, share: 0.45 }
  ];
  let placedTotal = 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const n = r === rows.length - 1 ? count - placedTotal : Math.round(count * row.share);
    placedTotal += n;
    const spacing = W / n;
    for (let i = 0; i < n; i++) {
      // Staggered: far row sits between the near row's doors
      let x = (i + 0.5 + (r % 2 ? 0.5 : 0)) * spacing
            + (Math.random() * 2 - 1) * spacing * row.jitter * 0.4;
      x = Math.min(W - 0.4, Math.max(0.4, x));
      // Near row keeps clear of the hero doors
      if (row.z > -8 && doorXs.some(dx => Math.abs(dx - x) < 1.4)) {
        x += spacing * 0.5 * (x < W / 2 ? 1 : -1);
      }

      const size = row.size * (0.9 + Math.random() * 0.2);
      const dNorm = (Math.abs(row.z) - 2.8) / 12;
      const dim = (1.0 - dNorm * 0.35) * (0.85 + Math.random() * 0.15);
      const tint = new THREE.Color(dim * 0.88, dim * 0.92, dim * 1.0);

      const g = new THREE.Group();
      const startsOpen = Math.random() < 0.3;
      const closed = facePlane(texClosed, startsOpen ? 0 : 1, tint);
      const open = facePlane(Math.random() < 0.5 ? texAjar : texOpen, startsOpen ? 1 : 0, tint);
      const halo = facePlane(texHalo, 0, tint, true);
      halo.scale.setScalar(1.25);
      halo.position.z = -0.01;
      g.add(halo, closed, open);

      g.position.set(x, size / 2 - 0.06 + 0.14, row.z); // slight lift, still grounded
      g.scale.setScalar(size);

      doors.push({
        g, closed, open, halo,
        phase: Math.random() * Math.PI * 2,
        mix: startsOpen ? 1 : 0,
        target: startsOpen ? 1 : 0,
        nextFlip: 6 + Math.random() * 30
      });
      group.add(g);
    }
  }

  let lastT = 0;
  group.update = (t) => {
    const dt = Math.min(Math.max(t - lastT, 0), 0.1);
    lastT = t;
    for (const d of doors) {

      // Occasionally a door opens (or shuts) somewhere in the sky
      if (t >= d.nextFlip) {
        d.target = 1 - d.target;
        d.nextFlip = t + 10 + Math.random() * 35;
      }
      const speed = 0.9; // crossfade ~1.1s
      d.mix += Math.sign(d.target - d.mix) * Math.min(Math.abs(d.target - d.mix), speed * dt);
      const flicker = 0.92 + 0.08 * Math.sin(t * 1.3 + d.phase * 3.0);
      d.closed.material.opacity = (1 - d.mix) * flicker;
      d.open.material.opacity = d.mix * flicker;
      d.halo.material.opacity = d.mix * 0.3 * flicker;
    }
  };
  return group;
}

// ---------------------------------------------------------------- ground anchor

// Soft dark gradient along the very bottom so grass silhouettes sit on
// "ground" instead of floating over black.
export function makeGroundGlow(W) {
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, 'rgba(16,20,32,0.95)');
  g.addColorStop(0.5, 'rgba(12,15,26,0.5)');
  g.addColorStop(1, 'rgba(10,12,22,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 128);
  const tex = new THREE.CanvasTexture(cv);

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 1.02, 0.55),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.3, depthWrite: false, fog: false
    })
  );
  mesh.position.set(W / 2, 0.24, 2.8);
  return mesh;
}

// ---------------------------------------------------------------- petals

// Soft petals drifting across the whole panorama on a slow breeze.
export function makePetals(count, W, H) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(16, 14, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,225,232,0.95)');
  g.addColorStop(0.55, 'rgba(240,190,205,0.55)');
  g.addColorStop(1, 'rgba(240,190,205,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(16, 16, 13, 8, 0.6, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0.75,
    depthWrite: false, side: THREE.DoubleSide, fog: true
  });
  const geo = new THREE.PlaneGeometry(0.05, 0.035);
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;

  const seeds = [];
  for (let i = 0; i < count; i++) {
    seeds.push({
      x: Math.random() * W,
      y: 0.2 + Math.random() * (H * 0.75),
      z: -3 + Math.random() * 7,
      drift: 0.12 + Math.random() * 0.25,   // wind speed (m/s)
      flutter: 1.5 + Math.random() * 2.5,
      ph: Math.random() * Math.PI * 2,
      s: 0.7 + Math.random() * 0.9
    });
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s3 = new THREE.Vector3();
  const p = new THREE.Vector3();
  mesh.update = (t) => {
    for (let i = 0; i < seeds.length; i++) {
      const sd = seeds[i];
      const x = (sd.x + t * sd.drift) % (W + 1) - 0.5;
      p.set(
        x,
        sd.y + Math.sin(t * 0.7 + sd.ph) * 0.25 + Math.sin(t * sd.flutter + sd.ph) * 0.05,
        sd.z
      );
      e.set(
        Math.sin(t * sd.flutter + sd.ph) * 0.9,
        Math.cos(t * sd.flutter * 0.7 + sd.ph) * 0.9,
        sd.ph
      );
      q.setFromEuler(e);
      s3.setScalar(sd.s);
      m.compose(p, q, s3);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return mesh;
}

// ---------------------------------------------------------------- trees

// Foreground hanging branches framing the top edge — the closest layer.
export function makeTrees(W, H) {
  const group = new THREE.Group();
  const tex = loadTex('assets/textures/branch.png');
  const spots = [0.055, 0.21, 0.38, 0.565, 0.75, 0.94];
  const items = [];
  for (const f of spots) {
    const geo = new THREE.PlaneGeometry(1.5, 1.5);
    geo.translate(0, -0.7, 0); // pivot at the top edge
    // Additive: the black background vanishes, only the moonlit leaf lace shows
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.85, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xbfc8dd, fog: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    const s = 1.15 + Math.random() * 0.8;
    mesh.scale.set(s * (Math.random() < 0.5 ? -1 : 1), s, 1);
    mesh.position.set(f * W + (Math.random() - 0.5) * 0.6, H + 0.12, 3.8);
    items.push({ mesh, ph: Math.random() * Math.PI * 2, base: (Math.random() - 0.5) * 0.06 });
    group.add(mesh);
  }
  group.update = (t) => {
    for (const it of items) {
      it.mesh.rotation.z = it.base + Math.sin(t * 0.35 + it.ph) * 0.022;
    }
  };
  return group;
}

// ---------------------------------------------------------------- lanterns

// Warm sky lanterns rising slowly through the night.
export function makeLanterns(count, W, H) {
  const group = new THREE.Group();
  const tex = loadTex('assets/textures/lantern.png');
  const items = [];
  for (let i = 0; i < count; i++) {
    const depth = -8 - Math.random() * 10;
    const s = 0.55 - ((Math.abs(depth) - 8) / 10) * 0.28;
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.75 * s, s), mat);
    mesh.position.z = depth;
    items.push({
      mesh,
      x0: Math.random() * W,
      y0: Math.random() * (H + 1),
      rise: 0.025 + Math.random() * 0.035,
      swayA: 0.15 + Math.random() * 0.25,
      swayF: 0.15 + Math.random() * 0.2,
      ph: Math.random() * Math.PI * 2
    });
    group.add(mesh);
  }
  group.update = (t) => {
    for (const it of items) {
      const span = H + 1.2;
      it.mesh.position.y = ((it.y0 + t * it.rise) % span) - 0.3;
      it.mesh.position.x = it.x0 + Math.sin(t * it.swayF + it.ph) * it.swayA;
      it.mesh.material.opacity = 0.72 + 0.28 * Math.sin(t * 2.1 + it.ph * 3.0);
      it.mesh.rotation.z = Math.sin(t * 0.4 + it.ph) * 0.06;
    }
  };
  return group;
}

// ---------------------------------------------------------------- butterflies

// Luminous butterflies fluttering low over the flowers.
export function makeButterflies(count, W) {
  const group = new THREE.Group();
  const tex = loadTex('assets/textures/butterfly.png');
  // sample only the inner region — the generated image has a faint border
  tex.repeat.set(0.78, 0.78);
  tex.offset.set(0.11, 0.11);
  const items = [];
  for (let i = 0; i < count; i++) {
    const s = 0.11 + Math.random() * 0.08;
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide, fog: false
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.position.z = 1.2 + Math.random() * 2;
    items.push({
      mesh, s,
      ax: Math.random() * W,
      ay: 0.35 + Math.random() * 0.6,
      r: 0.4 + Math.random() * 0.6,
      sp: 0.12 + Math.random() * 0.18,
      flap: 8 + Math.random() * 5,
      ph: Math.random() * Math.PI * 2
    });
    group.add(mesh);
  }
  group.update = (t) => {
    for (const it of items) {
      it.mesh.position.x = it.ax + Math.sin(t * it.sp + it.ph) * it.r * 2.2;
      it.mesh.position.y = it.ay + Math.sin(t * it.sp * 1.9 + it.ph * 2) * it.r * 0.5
        + Math.abs(Math.sin(t * it.flap * 0.5 + it.ph)) * 0.03;
      // wing flap: squash X
      it.mesh.scale.set(it.s * (0.35 + 0.65 * Math.abs(Math.sin(t * it.flap + it.ph))), it.s, 1);
      it.mesh.rotation.z = Math.sin(t * it.sp * 3 + it.ph) * 0.3;
    }
  };
  return group;
}

// ---------------------------------------------------------------- aurora

// Procedural aurora ribbon dancing across all five walls — pure shader,
// loops by construction, unapologetically magical.
const AURORA_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vWorld;
  uniform float uTime;
  uniform float uH;

  void main() {
    float x = vWorld.x;
    float y = vWorld.y;
    float center = uH * 0.74
      + sin(x * 0.33 + uTime * 0.12) * uH * 0.09
      + sin(x * 0.11 - uTime * 0.05) * uH * 0.07;
    float d = (y - center) / (uH * 0.16);
    float band = exp(-d * d * 3.0);
    // curtain streaks sweeping slowly
    float streak = 0.55 + 0.45 * sin(x * 5.0 + uTime * 0.45 + sin(x * 1.7 + uTime * 0.1) * 2.0);
    // brighter above the band centerline (real aurora falls off downward fast)
    float lift = smoothstep(-1.4, 0.4, d);
    float a = band * streak * lift * (0.32 + 0.12 * sin(uTime * 0.21));
    vec3 teal = vec3(0.15, 0.95, 0.62);
    vec3 violet = vec3(0.55, 0.30, 0.95);
    vec3 col = mix(teal, violet, 0.5 + 0.5 * sin(x * 0.18 + uTime * 0.06));
    gl_FragColor = vec4(col * a, a);
  }
`;

export function makeAurora(W, H) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: FOG_VERT,
    fragmentShader: AURORA_FRAG,
    uniforms: { uTime: { value: 0 }, uH: { value: H } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.3, H * 1.2), mat);
  mesh.position.set(W / 2, H * 0.6, -27);
  mesh.renderOrder = -8;
  mesh.update = (t) => { mat.uniforms.uTime.value = t; };
  return mesh;
}

// ---------------------------------------------------------------- celestial

// A soft moon high in the sky + occasional shooting stars.
export function makeCelestial(W, H) {
  const group = new THREE.Group();

  // moon disc + halo
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  let g = ctx.createRadialGradient(64, 64, 0, 64, 64, 30);
  g.addColorStop(0, 'rgba(250,250,255,1)');
  g.addColorStop(0.85, 'rgba(235,238,255,0.9)');
  g.addColorStop(1, 'rgba(225,230,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const discTex = new THREE.CanvasTexture(cv);
  discTex.colorSpace = THREE.SRGBColorSpace;

  const cv2 = document.createElement('canvas');
  cv2.width = cv2.height = 128;
  const ctx2 = cv2.getContext('2d');
  g = ctx2.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(200,210,255,0.5)');
  g.addColorStop(0.5, 'rgba(180,195,255,0.14)');
  g.addColorStop(1, 'rgba(180,195,255,0)');
  ctx2.fillStyle = g;
  ctx2.fillRect(0, 0, 128, 128);
  const haloTex = new THREE.CanvasTexture(cv2);

  function sprite(tex, scale, opacity) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    sp.scale.setScalar(scale);
    return sp;
  }
  const halo = sprite(haloTex, 3.4, 0.8);
  const disc = sprite(discTex, 1.0, 0.95);
  const moonPos = new THREE.Vector3(W * 0.62, H * 0.88, -28);
  halo.position.copy(moonPos);
  disc.position.copy(moonPos);
  group.add(halo, disc);

  // shooting stars
  const scv = document.createElement('canvas');
  scv.width = 128; scv.height = 8;
  const sctx = scv.getContext('2d');
  const sg = sctx.createLinearGradient(0, 0, 128, 0);
  sg.addColorStop(0, 'rgba(255,255,255,0)');
  sg.addColorStop(0.8, 'rgba(255,255,255,0.85)');
  sg.addColorStop(1, 'rgba(255,255,255,1)');
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 128, 8);
  const streakTex = new THREE.CanvasTexture(scv);

  const stars = [];
  for (let i = 0; i < 3; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.035),
      new THREE.MeshBasicMaterial({
        map: streakTex, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      })
    );
    mesh.position.z = -26;
    group.add(mesh);
    stars.push({ mesh, t0: -99, nextAt: 4 + i * 9 + Math.random() * 8, dirX: 0, dirY: 0 });
  }

  group.update = (t) => {
    halo.material.opacity = 0.7 + 0.15 * Math.sin(t * 0.4);
    for (const st of stars) {
      if (t >= st.nextAt) {
        st.t0 = t;
        st.nextAt = t + 12 + Math.random() * 22;
        const goingRight = Math.random() < 0.5;
        st.dirX = (goingRight ? 1 : -1) * (4.5 + Math.random() * 2);
        st.dirY = -(1.2 + Math.random() * 0.8);
        st.mesh.position.set(Math.random() * W, H * (0.75 + Math.random() * 0.2), -26);
        st.mesh.rotation.z = Math.atan2(st.dirY, st.dirX) + (goingRight ? 0 : Math.PI);
      }
      const life = t - st.t0;
      const DUR = 0.9;
      if (life >= 0 && life < DUR) {
        st.mesh.position.x += st.dirX * 0.016;
        st.mesh.position.y += st.dirY * 0.016;
        st.mesh.material.opacity = Math.sin((life / DUR) * Math.PI) * 0.9;
      } else {
        st.mesh.material.opacity = 0;
      }
    }
  };
  return group;
}

// ---------------------------------------------------------------- stars

// A field of stars scattered across the upper sky, each twinkling on its own
// phase (a scatter of rare bright ones). Static positions → nearly free; sits
// just in front of the sky pano, additive so only the faint light adds — small
// and dim enough that bloom never latches onto them.
export function makeStars(count, W, H) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const aPhase = new Float32Array(count);
  const aSpeed = new Float32Array(count);
  const aSize = new Float32Array(count);
  const aBright = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = Math.random() * W;
    pos[i * 3 + 1] = H * 0.44 + Math.random() * H * 0.8;   // upper sky only
    pos[i * 3 + 2] = -27 + Math.random() * 2;
    aPhase[i] = Math.random() * Math.PI * 2;
    aSpeed[i] = 0.3 + Math.random() * 1.4;
    const big = Math.random() < 0.07;
    aSize[i] = big ? 5 + Math.random() * 4 : 1.5 + Math.random() * 2.2;
    aBright[i] = big ? 0.7 + Math.random() * 0.25 : 0.32 + Math.random() * 0.4;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(aSpeed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  geo.setAttribute('aBright', new THREE.BufferAttribute(aBright, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float aPhase, aSpeed, aSize, aBright;
      uniform float uTime;
      varying float vA;
      void main() {
        float tw = 0.35 + 0.65 * pow(abs(sin(uTime * aSpeed + aPhase)), 1.8);
        vA = aBright * tw;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * (0.7 + 0.5 * tw);
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        float c = smoothstep(0.5, 0.0, r);
        gl_FragColor = vec4(vec3(0.82, 0.88, 1.0), c * vA);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = -9;   // over the sky pano, under the moon/aurora glow
  points.update = (t) => { mat.uniforms.uTime.value = t; };
  return points;
}

// ---------------------------------------------------------------- fireflies

// Fireflies that each twinkle on their OWN phase (not one global flicker), with
// a scatter of rare big bright sparkles. Per-point size + alpha are driven in a
// shader so hundreds of them cost almost nothing.
const FF_VERT = /* glsl */`
  attribute float aPhase, aSpeed, aSize, aBright;
  uniform float uTime;
  varying float vA;
  void main() {
    float tw = 0.28 + 0.72 * pow(abs(sin(uTime * aSpeed + aPhase)), 2.5);
    vA = aBright * tw;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * (0.65 + 0.55 * tw);
  }
`;
const FF_FRAG = /* glsl */`
  precision highp float;
  varying float vA;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, r);
    float glow = pow(core, 2.4);
    vec3 col = mix(vec3(1.0, 0.90, 0.62), vec3(1.0, 1.0, 0.92), glow);
    gl_FragColor = vec4(col, glow * vA);
  }
`;

export function makeFireflies(count, W, opts = {}) {
  const zMin = opts.zMin ?? -2, zSpan = (opts.zMax ?? 4) - zMin;
  const sizeScale = opts.sizeScale ?? 1;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const aPhase = new Float32Array(count);
  const aSpeed = new Float32Array(count);
  const aSize = new Float32Array(count);
  const aBright = new Float32Array(count);
  const seeds = [];
  for (let i = 0; i < count; i++) {
    const low = Math.random() < 0.7;
    seeds.push({
      x: Math.random() * W,
      y: low ? 0.05 + Math.random() * 0.8 : 0.6 + Math.random() * 1.4,
      z: zMin + Math.random() * zSpan,
      ax: 0.3 + Math.random() * 0.9,
      ay: 0.15 + Math.random() * 0.4,
      sp: 0.2 + Math.random() * 0.6,
      ph: Math.random() * Math.PI * 2
    });
    aPhase[i] = Math.random() * Math.PI * 2;
    aSpeed[i] = 0.7 + Math.random() * 2.6;            // individual twinkle rate
    const big = Math.random() < 0.12;                 // rare bold sparkles
    aSize[i] = (big ? 22 + Math.random() * 16 : 7 + Math.random() * 8) * sizeScale;
    aBright[i] = big ? 0.9 + Math.random() * 0.4 : 0.45 + Math.random() * 0.4;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(aSpeed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  geo.setAttribute('aBright', new THREE.BufferAttribute(aBright, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: FF_VERT, fragmentShader: FF_FRAG,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.update = (t) => {
    mat.uniforms.uTime.value = t;
    const a = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      a[i * 3] = s.x + Math.sin(t * s.sp + s.ph) * s.ax;
      a[i * 3 + 1] = s.y + Math.sin(t * s.sp * 1.7 + s.ph * 2.0) * s.ay;
      a[i * 3 + 2] = s.z + Math.cos(t * s.sp * 0.8 + s.ph) * 0.4;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return points;
}
