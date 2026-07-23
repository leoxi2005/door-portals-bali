// The three interactive hero doors.
// Each door = frame + hinged panel (real 3D, swings open) + portal plane
// showing its World + glow sprite + point light for light spill.
// State machine: idle -> opening -> overlay -> closing -> cooldown -> idle

import * as THREE from 'three';
import { loadTex } from './environment.js';
import { addDoorDecor } from './decor.js';

// Doors sit a little smaller than the frame height so the tree canopy arch has
// room to curve over the top (enchanted-portal framing).
const DOOR_W = 0.9;
const DOOR_H = 1.7;
const FRAME_T = 0.14;   // frame bar thickness
const PANEL_T = 0.07;

function makeGlowTexture() {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,250,235,1)');
  g.addColorStop(0.25, 'rgba(255,240,210,0.55)');
  g.addColorStop(0.6, 'rgba(255,220,170,0.16)');
  g.addColorStop(1, 'rgba(255,220,170,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let glowTexture = null;

// --- inner-shadow rim so the world video recesses into the doorway instead of
// reading as a hard-cut rectangle: transparent centre, soft indigo dark toward
// the four edges. Drawn just in front of the (opaque) portal, so it only darkens
// the video edges — never adds light (won't blow anything out).
let portalInnerTex = null;
function makeInnerShadowTexture() {
  const S = 256;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S, S), d = img.data;
  const feather = 0.16;                     // rim depth as fraction of the opening
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / (S - 1), v = y / (S - 1);
    const edge = Math.min(u, 1 - u, v, 1 - v) / feather;  // 0 at edge → 1 inside
    const k = 1 - Math.min(edge, 1);
    const a = Math.pow(k, 1.6) * 0.7;
    const idx = (y * S + x) * 4;
    d[idx] = 8; d[idx + 1] = 9; d[idx + 2] = 16; d[idx + 3] = Math.round(a * 255);
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Each world gets its own themed door face (assets/textures/doors/<palette>.png)
const doorFaceCache = {};
function doorFaceTex(palette) {
  if (!doorFaceCache[palette]) {
    doorFaceCache[palette] = loadTex(`assets/textures/doors/${palette}.png`);
  }
  return doorFaceCache[palette];
}


function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export class Door {
  constructor(index, xGlobal, world, timing) {
    this.index = index;
    this.x = xGlobal;       // center x in scene meters
    this.world = world;
    this.timing = timing;

    this.state = 'idle';
    this.stateT = 0;        // seconds in current state
    this.openAmount = 0;    // 0 closed .. 1 fully open
    this.held = false;      // zone "hold-to-view": true while a hand is touching

    this.group = new THREE.Group();
    this.group.position.set(xGlobal, DOOR_H / 2 + 0.02, 0); // base on the floor line
    // Each door faces clearly left/right (deterministic per index, min 5°)
    // so the lineup doesn't read as a flat row of frontal rectangles.
    const r = Math.sin((index + 1) * 127.317) * 0.5 + 0.5; // stable pseudo-random 0..1
    const sign = (index % 2 === 0) ? 1 : -1;
    // Gentle yaw only. (The old 12–26° was for the ortho camera; with the long
    // perspective lens a big yaw makes the oversized portal parallax past the
    // frame bars and show a doubled/offset copy of the world — a hard seam in
    // the doorway. A small angle still reads as 3D and keeps the portal clean.)
    this.group.rotation.y = sign * THREE.MathUtils.degToRad(3 + r * 4);
    this._build();
  }

  // Forgiving touch test in scene meters (no raycast needed — ortho, frontal).
  hitTest(xm, ym) {
    return Math.abs(xm - this.x) <= DOOR_W / 2 + 0.45 &&
           ym <= DOOR_H + 0.45;
  }

  // Same zone as hitTest but as a world-meter rectangle (for the calibrate overlay).
  hitRect() {
    return {
      x0: this.x - (DOOR_W / 2 + 0.45), x1: this.x + (DOOR_W / 2 + 0.45),
      y0: 0, y1: DOOR_H + 0.45
    };
  }

  _build() {
    const woodTexture = doorFaceTex(this.world.palette);
    // Panel: photographed oak on front/back faces, plain oak tone on the edges.
    // Moonlit grading: cool-tinted wood that belongs to the night scene;
    // the warm accents come only from the light seams / pool, not the wood.
    // Vintage white door (matches the original reference stills): catches the
    // moonlight and pops against the indigo night. Frame slightly darker grey
    // so panel/frame separate cleanly.
    const woodFaceMat = new THREE.MeshStandardMaterial({
      map: woodTexture, color: 0xffffff, roughness: 0.6, metalness: 0.03,
      emissive: 0x1c202c, emissiveIntensity: 0.55
    });
    const woodEdgeMat = new THREE.MeshStandardMaterial({
      color: 0xb9bcc4, roughness: 0.65, metalness: 0.03,
      emissive: 0x141720, emissiveIntensity: 0.5
    });
    const frameMat = new THREE.MeshStandardMaterial({
      map: woodTexture, color: 0x9fa3ad, roughness: 0.7, metalness: 0.03,
      emissive: 0x12151d, emissiveIntensity: 0.5
    });

    // --- frame (left, right, top bars + threshold)
    const sideGeo = new THREE.BoxGeometry(FRAME_T, DOOR_H + FRAME_T * 2, FRAME_T * 1.4);
    const left = new THREE.Mesh(sideGeo, frameMat);
    left.position.set(-(DOOR_W / 2 + FRAME_T / 2), 0, 0);
    const right = left.clone();
    right.position.x = DOOR_W / 2 + FRAME_T / 2;
    const topGeo = new THREE.BoxGeometry(DOOR_W + FRAME_T * 2, FRAME_T, FRAME_T * 1.4);
    const top = new THREE.Mesh(topGeo, frameMat);
    top.position.set(0, DOOR_H / 2 + FRAME_T / 2, 0);
    const sill = new THREE.Mesh(topGeo, frameMat);
    sill.position.set(0, -(DOOR_H / 2 + FRAME_T / 2), 0);
    for (const part of [left, right, top, sill]) {
      part.castShadow = true;
      part.receiveShadow = true;
    }
    this.group.add(left, right, top, sill);

    // --- hinged panel. The door swings OUTWARD toward the audience, pivoting
    // on the edge nearest the viewer (opposite the handle) — like a door
    // being opened to welcome you in.
    const hingeLeft = this.group.rotation.y > 0;
    this.swingSign = hingeLeft ? -1 : 1; // negative Y-rotation sweeps a left-hinged panel toward +z
    this.hinge = new THREE.Group();
    this.hinge.position.set(hingeLeft ? -DOOR_W / 2 : DOOR_W / 2, 0, PANEL_T / 2);
    // BoxGeometry face order: +x, -x, +y, -y, +z (front), -z (back)
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(DOOR_W, DOOR_H, PANEL_T),
      [woodEdgeMat, woodEdgeMat, woodEdgeMat, woodEdgeMat, woodFaceMat, woodFaceMat]
    );
    panel.position.x = hingeLeft ? DOOR_W / 2 : -DOOR_W / 2;
    panel.castShadow = true;
    panel.receiveShadow = true;
    this.hinge.add(panel);

    // handle — always on the edge opposite the hinge
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0xd9d3c4, roughness: 0.3, metalness: 0.9
    });
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.14, 12), handleMat
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.set(hingeLeft ? DOOR_W - 0.13 : -(DOOR_W - 0.13), -0.05, PANEL_T / 2 + 0.05);
    this.hinge.add(handle);
    this.group.add(this.hinge);

    // --- light seams: magic light leaking through the cracks of the closed door
    const seamMat = new THREE.MeshBasicMaterial({
      color: 0xffe3a8, transparent: true, opacity: 0.2,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    this.seams = [];
    const seamSpecs = [
      [0.035, DOOR_H, -DOOR_W / 2 + 0.01, 0],            // hinge side
      [0.035, DOOR_H, DOOR_W / 2 - 0.01, 0],             // handle side
      [DOOR_W, 0.035, 0, DOOR_H / 2 - 0.01],             // top
      [DOOR_W, 0.05, 0, -DOOR_H / 2 + 0.02]              // bottom (brightest)
    ];
    for (const [w, h, x, y] of seamSpecs) {
      const seam = new THREE.Mesh(new THREE.PlaneGeometry(w, h), seamMat);
      seam.position.set(x, y, PANEL_T + 0.012);
      this.seams.push(seam);
      this.group.add(seam);
    }

    // --- portal (the world seen through the doorway). Sits ALMOST in the frame
    // plane (tiny z-gap) and only slightly larger than the opening. The old
    // design pushed it 0.1 back and oversized it by 0.3 to hide gaps when the
    // door yaws — but that big parallax made the overflow peek past the frame at
    // any oblique view (edge doors / yaw), showing a doubled, offset copy of the
    // world. Hugging the frame plane kills the parallax so one clean view fills
    // the opening from every angle; the small margin still hides thin edge gaps.
    this.portal = new THREE.Mesh(
      new THREE.PlaneGeometry(DOOR_W + 0.12, DOOR_H + 0.12),
      this.world.portalMaterial
    );
    this.portal.position.z = -0.025;
    this.group.add(this.portal);
    this.world.onMaterialsChanged = () => {
      this.portal.material = this.world.portalMaterial;
    };

    // Soft inner-shadow rim over the portal so the world video melts into the
    // doorway (recessed) rather than reading as a hard rectangle. Sits just in
    // front of the opaque portal; the closed panel hides it until the door opens.
    if (!portalInnerTex) portalInnerTex = makeInnerShadowTexture();
    this.portalVignette = new THREE.Mesh(
      new THREE.PlaneGeometry(DOOR_W, DOOR_H),
      new THREE.MeshBasicMaterial({
        map: portalInnerTex, transparent: true, opacity: 0.85, depthWrite: false, fog: false
      })
    );
    this.portalVignette.position.z = 0.002;
    this.group.add(this.portalVignette);

    // rim of light around the doorway (blooms when open)
    this.rim = new THREE.Mesh(
      new THREE.PlaneGeometry(DOOR_W, DOOR_H),
      new THREE.MeshBasicMaterial({
        color: 0xfff3d8, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      })
    );
    this.rim.position.z = -0.09;
    this.group.add(this.rim);

    // --- glow sprite + light spill
    if (!glowTexture) glowTexture = makeGlowTexture();
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: 0xfff1d0, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    this.glow.scale.setScalar(3.2);
    this.glow.position.z = 0.35;
    this.group.add(this.glow);

    // Accent blended toward warm so the wood never goes sickly green/blue
    const accent = this.world.accentColor().lerp(new THREE.Color(0xffd9a0), 0.55);
    this.light = new THREE.PointLight(accent, 0, 9, 1.6);
    this.light.position.set(0, 0.6, 2.2); // far enough that the swung panel never blows out
    this.group.add(this.light);

    // --- soft contact shadow grounding the door onto the plate's meadow
    const shadowCv = document.createElement('canvas');
    shadowCv.width = shadowCv.height = 128;
    const sctx = shadowCv.getContext('2d');
    const sg = sctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    sg.addColorStop(0, 'rgba(0,0,0,0.75)');
    sg.addColorStop(0.6, 'rgba(0,0,0,0.35)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCv);
    this.contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(DOOR_W * 2.6, 1.1),
      new THREE.MeshBasicMaterial({
        map: shadowTex, transparent: true, opacity: 0.6,
        depthWrite: false, fog: false
      })
    );
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.set(0, -DOOR_H / 2 + 0.01, 0.25);
    this.group.add(this.contactShadow);

    // --- pool of light on the ground in front of the door
    this.pool = new THREE.Mesh(
      new THREE.PlaneGeometry(4.8, 2.4),
      new THREE.MeshBasicMaterial({
        map: glowTexture, color: 0xffe9c0, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      })
    );
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.position.set(0, -DOOR_H / 2 + 0.03, 1.3);
    this.group.add(this.pool);

    // --- fairy-tale greenery: vines over the frame + a little garden at the foot
    this.decor = addDoorDecor(this.group, this.index);
  }

  // Attract: a brief inviting crack-open when the wall has been quiet.
  tease() {
    if (this.state !== 'idle') return false;
    this.state = 'tease';
    this.stateT = 0;
    return true;
  }

  // A touch landed on this door.
  touch() {
    if (this.state === 'idle' || this.state === 'tease') {
      this.state = 'opening';
      this.stateT = 0;
      this.world.play();
      this.events?.open?.();
      return true;
    }
    if (this.state === 'overlay') {
      // second touch closes early
      this.state = 'closing';
      this.stateT = 0;
      this.events?.close?.();
      return true;
    }
    return false;
  }

  get busy() {
    return this.state !== 'idle';
  }

  // Explicit open/close for the Zone protocol (bridge sends 1 = touching, 0 = not).
  // Unlike touch() this never toggles: 1 only ever opens, 0 only ever closes.
  setOpen(want) {
    if (want) {
      if (this.state === 'idle' || this.state === 'tease') {
        this.state = 'opening'; this.stateT = 0;
        this.world.play(); this.events?.open?.();
      }
    } else {
      if (this.state === 'opening' || this.state === 'overlay') {
        this.state = 'closing'; this.stateT = 0; this.events?.close?.();
      }
    }
  }

  update(dt, t) {
    const T = this.timing;
    this.stateT += dt;
    // openAmount holds last frame's value here — fine for the 1-frame decor fade
    this.decor?.update(t, this.openAmount);

    switch (this.state) {
      case 'idle': {
        // gentle inviting pulse
        const pulse = 0.05 + 0.03 * Math.sin(t * 1.2 + this.index * 2.1);
        this.glow.material.opacity = pulse;
        this.rim.material.opacity = 0;
        this.seams[0].material.opacity = 0.22 + 0.13 * Math.sin(t * 1.5 + this.index * 1.7);
        this.light.intensity = 7 + 2.5 * Math.sin(t * 1.2 + this.index * 2.1);
        this.pool.material.opacity = 0.07 + 0.03 * Math.sin(t * 1.5 + this.index * 1.7);
        this.openAmount = 0;
        break;
      }
      case 'tease': {
        // 0.7s crack open to 14% → hold 0.8s → 0.7s close
        const tt = this.stateT;
        let k;
        if (tt < 0.7) k = easeInOutCubic(tt / 0.7);
        else if (tt < 1.5) k = 1;
        else k = 1 - easeInOutCubic(Math.min((tt - 1.5) / 0.7, 1));
        this.openAmount = k * 0.14;
        if (tt >= 2.2) { this.state = 'idle'; this.stateT = 0; }
        break;
      }
      case 'opening': {
        const k = Math.min(this.stateT / T.openDuration, 1);
        this.openAmount = easeInOutCubic(k);
        if (k >= 1) { this.state = 'overlay'; this.stateT = 0; }
        break;
      }
      case 'overlay': {
        // Door held open — the world lives behind the doorway (portal only).
        // While a hand is on the wall (held) it stays open up to a safety cap;
        // otherwise it auto-closes after the normal hold.
        this.openAmount = 1;
        const cap = this.held ? (T.overlayMaxHold ?? 60) : T.overlayHold;
        if (this.stateT >= cap) {
          this.state = 'closing';
          this.stateT = 0;
          this.events?.close?.();
        }
        break;
      }
      case 'closing': {
        const k = Math.min(this.stateT / T.closeDuration, 1);
        this.openAmount = 1 - easeInOutCubic(k);
        if (k >= 1) {
          this.state = 'cooldown';
          this.stateT = 0;
          this.world.pause();
        }
        break;
      }
      case 'cooldown': {
        this.openAmount = 0;
        if (this.stateT >= T.cooldown) { this.state = 'idle'; this.stateT = 0; }
        break;
      }
    }

    // Apply openAmount to the visuals — the panel swings OUTWARD toward the
    // viewer, stopping at 75° so its face stays visible while fully open.
    this.hinge.rotation.y = this.swingSign * this.openAmount * THREE.MathUtils.degToRad(130);
    if (this.state !== 'idle') {
      // No glow on the reveal — the world behind the door reads as-is.
      const a = this.openAmount;
      this.glow.material.opacity = (1 - a) * 0.05;
      this.glow.scale.setScalar(3.0);
      this.rim.material.opacity = 0;
      this.seams[0].material.opacity = (1 - a) * 0.15;
      // Gentle spill — enough to read the panel, never enough to burn it
      this.light.intensity = 7 + a * 7;
      this.pool.material.opacity = 0.07 + a * 0.18;
    }
  }
}
