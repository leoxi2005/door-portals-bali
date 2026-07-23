// Fairy-tale "tree-arch portal" dressing around each hero door.
//
// Design goals (per user direction):
//  - Every door is a UNIQUE little nook: trunks vary in species, size, lean and
//    placement, and one side is usually dominant so nothing reads as a repeated
//    stamp.
//  - Foliage frames the doorway but never blocks it; when the door OPENS the
//    on-door greenery (ivy) parts away and the front bushes dim, so the world
//    video reads clean through the opening. The flanking trunks stay as a frame.
//  - Warm light from inside the doorway kisses the nearby trunks (ref: enchanted
//    glowing door among dark trees), tying the cutouts into the scene light.
//
// INTEGRATION: the scene uses a deep-indigo FogExp2. All big billboards opt into
// that fog (fog:true) + a cool night tint so they dissolve into the same
// atmosphere as the doors instead of looking pasted on. Contact shadows plant
// them on the ground. Everything attaches to the door's Y-rotated group.

import * as THREE from 'three';
import { loadTex } from './environment.js';

const DOOR_W = 0.9;
const DOOR_H = 1.7;

const texCache = {};
function tex(path) { return texCache[path] || (texCache[path] = loadTex(path)); }

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TREES = ['tree-oak-a', 'tree-oak-b', 'tree-willow', 'tree-oakbroad', 'tree-slender'];
const TREE_AR = 1792 / 2432, IVY_AR = 1536 / 2688, BUSH_AR = 2432 / 1792;

function billboard(map, w, h, { x, y, z, pivot = 'center', flip = 1, opacity = 1, tint = 0x7b88a8, rot = 0, fadeBottom = 0 }) {
  const geo = new THREE.PlaneGeometry(w, h);
  if (pivot === 'bottom') geo.translate(0, h / 2, 0);
  else if (pivot === 'top') geo.translate(0, -h / 2, 0);
  const mat = new THREE.MeshBasicMaterial({
    map, color: tint, transparent: true, opacity, alphaTest: 0.03, depthWrite: false, fog: true
  });
  // Dissolve the very bottom of the texture into the ground (e.g. tree roots),
  // so a billboard's exposed-root base never reads as "uprooted / floating".
  if (fadeBottom > 0) {
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = 'varying float vFadeY;\n' + shader.vertexShader.replace(
        '#include <uv_vertex>', '#include <uv_vertex>\n  vFadeY = uv.y;'
      );
      shader.fragmentShader = 'varying float vFadeY;\n' + shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>\n  diffuseColor.a *= smoothstep(0.0, ${fadeBottom.toFixed(3)}, vFadeY);`
      );
    };
  }
  const m = new THREE.Mesh(geo, mat);
  m.scale.x = flip;
  m.position.set(x, y, z);
  m.rotation.z = rot;
  return m;
}

// cool night tint, slightly randomized darkness so masses vary
function coolTint(rng, lo = 0.34, hi = 0.46) {
  const v = lo + rng() * (hi - lo);
  return new THREE.Color(v * 0.86, v * 0.94, v * 1.18);
}

let shadowTex = null;
function contactShadow(w, x, z, op = 0.5) {
  if (!shadowTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(0.6, 'rgba(0,0,0,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    shadowTex = new THREE.CanvasTexture(cv);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, w * 0.4),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: op, depthWrite: false, fog: true })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, -DOOR_H / 2 + 0.03, z);
  return m;
}

// --- glowing toadstool (procedural) ------------------------------------------
const mushroomCache = {};
function mushroomTexture(kind) {
  if (mushroomCache[kind]) return mushroomCache[kind];
  const S = 256; const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const caps = {
    coral: { cap: '#e8736b', rim: '#ffb3a0', glow: 'rgba(255,150,120,', dot: '#fff2ea' },
    teal:  { cap: '#5fd6c4', rim: '#b8fff2', glow: 'rgba(120,240,225,', dot: '#eafffb' },
    violet:{ cap: '#b48ad6', rim: '#e6c6ff', glow: 'rgba(200,150,255,', dot: '#f6ecff' }
  };
  const c = caps[kind] ?? caps.coral;
  const halo = ctx.createRadialGradient(S / 2, S * 0.52, 0, S / 2, S * 0.52, S * 0.5);
  halo.addColorStop(0, c.glow + '0.55)'); halo.addColorStop(0.4, c.glow + '0.18)'); halo.addColorStop(1, c.glow + '0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#efe7d6';
  ctx.beginPath(); ctx.moveTo(S * 0.44, S * 0.55);
  ctx.quadraticCurveTo(S * 0.42, S * 0.78, S * 0.46, S * 0.86); ctx.lineTo(S * 0.54, S * 0.86);
  ctx.quadraticCurveTo(S * 0.58, S * 0.78, S * 0.56, S * 0.55); ctx.closePath(); ctx.fill();
  const cg = ctx.createLinearGradient(0, S * 0.28, 0, S * 0.6);
  cg.addColorStop(0, c.rim); cg.addColorStop(1, c.cap); ctx.fillStyle = cg;
  ctx.beginPath(); ctx.ellipse(S / 2, S * 0.55, S * 0.24, S * 0.20, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = 'rgba(60,40,50,0.25)'; ctx.fillRect(S * 0.26, S * 0.54, S * 0.48, S * 0.02);
  ctx.fillStyle = c.dot;
  for (const [dx, dy, r] of [[-0.10, -0.04, 0.035], [0.06, -0.06, 0.028], [0.12, 0.01, 0.022], [-0.02, 0.02, 0.03]]) {
    ctx.beginPath(); ctx.arc(S / 2 + dx * S, S * 0.5 + dy * S, r * S, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  mushroomCache[kind] = t; return t;
}

// warm radial glow (door spill on the foliage)
let warmTex = null;
function warmGlowTexture() {
  if (warmTex) return warmTex;
  const S = 256; const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,226,170,0.9)'); g.addColorStop(0.4, 'rgba(255,200,130,0.35)');
  g.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  warmTex = new THREE.CanvasTexture(cv); warmTex.colorSpace = THREE.SRGBColorSpace; return warmTex;
}

// A faint background forest scattered among the far floating (dummy) doors, so
// the middle distance has trees too and the scene recedes by near/far scale. The
// deep fog swallows most of it into soft indigo silhouettes — depth, not detail.
export function makeFarTrees(W, count = 9) {
  const group = new THREE.Group();
  const items = [];
  for (let i = 0; i < count; i++) {
    const name = TREES[Math.floor(Math.random() * TREES.length)];
    const z = -7 - Math.random() * 7;                       // deep behind the dummy doors
    const depth = (-z - 7) / 7;                             // 0 near .. 1 far
    const h = (2.2 + Math.random() * 1.2) * (1 - depth * 0.3);
    const w = h * TREE_AR;
    // Dark, hazy silhouettes only — they read as depth, never as detailed trees
    // (so no visible "uprooted" root flare floating at the horizon).
    const v = 0.13 - depth * 0.05;
    const t = billboard(tex('assets/textures/decor/' + name + '.png'), w, h, {
      x: Math.random() * W,
      y: -0.35 - Math.random() * 0.4,                       // base sunk low → roots hidden
      z,
      pivot: 'bottom',
      flip: Math.random() < 0.5 ? -1 : 1,
      rot: (Math.random() - 0.5) * 0.18,
      opacity: 0.6,
      tint: new THREE.Color(v * 0.8, v * 0.9, v * 1.25),
      fadeBottom: 0.22
    });
    group.add(t);
    items.push({ mesh: t, base: t.rotation.z, amp: 0.005 + Math.random() * 0.005,
                 freq: 0.1 + Math.random() * 0.06, ph: Math.random() * 6.28 });
  }
  group.update = (tm) => {
    for (const it of items) it.mesh.rotation.z = it.base + Math.sin(tm * it.freq + it.ph) * it.amp;
  };
  return group;
}

export function addDoorDecor(group, index) {
  const rng = mulberry32((index + 1) * 2654435761);
  const swayers = [];
  const openables = []; // { mesh, base, fade } — fade away as the door opens

  const pickTree = () => tex('assets/textures/decor/' + TREES[Math.floor(rng() * TREES.length)] + '.png');

  // --- two flanking trunks, asymmetric: one side dominant ------------------
  // Roots planted on the ground (pivot at base) so the crown sways but the trunk
  // never lifts. Placed BEHIND the portal (z < -0.1) so the world video always
  // occludes them inside the doorway — foliage can only ever frame, never cover.
  const GROUND = -DOOR_H / 2;
  const dominant = rng() < 0.5 ? -1 : 1;
  for (const s of [-1, 1]) {
    const boss = (s === dominant);
    const th = (boss ? 2.9 + rng() * 0.8 : 2.2 + rng() * 0.5);   // dominant taller
    const tw = th * TREE_AR;
    const xoff = (boss ? 0.72 + rng() * 0.2 : 0.82 + rng() * 0.25);
    const rot = (rng() - 0.5) * 0.24 - s * 0.05;                 // lean slightly inward
    const flip = s * (rng() < 0.35 ? -1 : 1);
    const t = billboard(pickTree(), tw, th, {
      x: s * xoff, y: GROUND - 0.16 - rng() * 0.12, z: -0.16 - rng() * 0.12,
      pivot: 'bottom', flip, rot, opacity: 0.97, tint: coolTint(rng), fadeBottom: 0.22
    });
    group.add(contactShadow(1.2 + rng() * 0.5, s * xoff, 0.04 + rng() * 0.06, 0.5));
    group.add(t);
    swayers.push({ mesh: t, base: rot, amp: 0.005 + rng() * 0.005, freq: 0.13 + rng() * 0.06, ph: rng() * 6.28 });
  }
  // occasional third small sapling for a wilder nook
  if (rng() < 0.4) {
    const th = 1.5 + rng() * 0.5, tw = th * TREE_AR, s = rng() < 0.5 ? -1 : 1;
    const t = billboard(pickTree(), tw, th, {
      x: s * (1.0 + rng() * 0.3), y: GROUND - 0.1, z: -0.34, pivot: 'bottom',
      flip: s, rot: (rng() - 0.5) * 0.3, opacity: 0.9, tint: coolTint(rng, 0.28, 0.38), fadeBottom: 0.2
    });
    group.add(t);
    swayers.push({ mesh: t, base: t.rotation.z, amp: 0.007, freq: 0.18 + rng() * 0.06, ph: rng() * 6.28 });
  }

  // --- ivy arch over the top (varied, sometimes skipped) -------------------
  // Sits high so it frames rather than drapes into the doorway; on open it lifts
  // and fades so the world video reads perfectly clean.
  if (rng() < 0.75) {
    const cw = 1.9 + rng() * 0.6, ch = cw * (1536 / 2688);
    const arch = billboard(tex('assets/textures/decor/canopy-arch.png'), cw, ch, {
      x: (rng() - 0.5) * 0.3, y: 1.12 + rng() * 0.12, z: -0.16,
      flip: rng() < 0.5 ? -1 : 1, opacity: 0.95, tint: coolTint(rng, 0.4, 0.52)
    });
    group.add(arch);
    swayers.push({ mesh: arch, base: 0, amp: 0.007, freq: 0.2, ph: rng() * 6.28 });
  }

  // --- ivy trails at the frame EDGES only; they part away when the door opens
  const ivyMap = tex('assets/textures/decor/ivy-strand.png');
  const edgeXs = [-0.42, -0.32, 0.34, 0.44];
  for (const bx of edgeXs) {
    if (rng() < 0.45) continue;
    const h = 0.5 + rng() * 0.5;
    const w = h * IVY_AR * (1.0 + rng() * 0.4);
    const op = 0.85;
    const m = billboard(ivyMap, w, h, {
      x: bx + (rng() - 0.5) * 0.06, y: DOOR_H / 2 - 0.02, z: 0.1, pivot: 'top',
      flip: rng() < 0.5 ? -1 : 1, opacity: op, tint: coolTint(rng, 0.5, 0.62)
    });
    m.rotation.z = (rng() - 0.5) * 0.1;
    group.add(m);
    swayers.push({ mesh: m, base: m.rotation.z, amp: 0.03 + rng() * 0.02, freq: 0.3 + rng() * 0.2, ph: rng() * 6.28 });
    openables.push({ mesh: m, base: op, fade: 1.0 }); // fully part away when open
  }

  // --- flowering garden at the foot ----------------------------------------
  // Clumps sit at the door's LEFT/RIGHT foot (never centre) so they frame the
  // threshold without covering the door face / the world video when it opens.
  const bushMap = tex('assets/textures/decor/bush-flowers.png');
  const groundY = -DOOR_H / 2 + 0.02;
  const spotX = [-0.74, -0.5, 0.5, 0.74];
  const nBush = 4;
  for (let i = 0; i < nBush; i++) {
    const bx = spotX[i] + (rng() - 0.5) * 0.12;
    const w = (0.5 + rng() * 0.26), h = w / BUSH_AR;   // low band, doesn't climb the door
    const op = 0.98;
    const m = billboard(bushMap, w, h, {
      x: bx, y: groundY - 0.02, z: 0.5 + rng() * 0.3, pivot: 'bottom',
      flip: rng() < 0.5 ? -1 : 1, opacity: op, tint: coolTint(rng, 0.56, 0.74)
    });
    group.add(m);
    swayers.push({ mesh: m, base: 0, amp: 0.012 + rng() * 0.01, freq: 0.45 + rng() * 0.25, ph: rng() * 6.28 });
    openables.push({ mesh: m, base: op, fade: 0.85 }); // fade well clear when the door opens
  }

  // --- warm door-spill glow on the near trunks -----------------------------
  const warm = new THREE.Sprite(new THREE.SpriteMaterial({
    map: warmGlowTexture(), color: 0xffdca0, opacity: 0.0,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  }));
  warm.scale.set(2.6, 2.0, 1);
  warm.position.set(0, -0.15, -0.12); // BEHIND the portal — lights the trees, never the video
  group.add(warm);

  return {
    update: (t, open = 0) => {
      const e = open * open * (3 - 2 * open);          // smooth 0..1
      // gentle idle sway, whipped into a gust as the door swings open. Trees are
      // base-pivoted, so only the crown stirs — roots stay planted.
      const gust = 1 + open * 3.0;
      for (const s of swayers) {
        s.mesh.rotation.z = s.base
          + Math.sin(t * s.freq + s.ph) * s.amp * gust
          + Math.sin(t * 6.0 + s.ph) * 0.02 * e;       // fast rustle while open
      }
      // Anything in FRONT of the portal must clear the moment the door cracks
      // open, or it paints over the world video. Ivy (fade≈1) vanishes almost
      // instantly; the low front bushes just dim so the lower video still reads.
      for (const o of openables) {
        const k = o.fade >= 0.9 ? (1 - Math.min(open / 0.15, 1)) : (1 - e * o.fade);
        o.mesh.material.opacity = o.base * k;
      }
      // warm spill breathes, and swells as the door opens (light pours out)
      warm.material.opacity = (0.10 + 0.05 * Math.sin(t * 1.1 + index)) * (1 - e * 0.4) + e * 0.3;
    }
  };
}
