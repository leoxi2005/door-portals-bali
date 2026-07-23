// NDI sender wrapper around `@stagetimerio/grandiose` (N-API binding).
// Manages multiple named senders (one per scene), receives RGBA buffers,
// converts RGBA -> BGRA in place, and pushes video frames to NDI.
//
// Because it is a Node-API (N-API) addon, the compiled binary is ABI-stable
// across Node/Electron versions — no electron-rebuild needed in normal cases.
// The package's install step downloads the NDI SDK and compiles the native addon.

let grandiose = null;
let loadError = null;
try {
  grandiose = require('@stagetimerio/grandiose');
} catch (err) {
  loadError = err;
  console.error('[ndi] grandiose failed to load:', err && err.message);
}

// Resolve the BGRA fourCC constant across grandiose versions.
function bgraFourCC() {
  if (!grandiose) return undefined;
  return (
    grandiose.FOURCC_BGRA ??
    grandiose.FOURCC_VIDEO_TYPE_BGRA ??
    grandiose.BGRA ??
    // ASCII 'BGRA' little-endian fallback
    0x41524742
  );
}

function progressiveFormat() {
  if (!grandiose) return undefined;
  return (
    grandiose.FORMAT_TYPE_PROGRESSIVE ??
    grandiose.FRAME_FORMAT_TYPE_PROGRESSIVE ??
    1
  );
}

// name -> { sender, width, height, fps, busy, frames, dropped }
const senders = new Map();

function isAvailable() {
  return !!grandiose;
}

function status() {
  const out = {
    available: !!grandiose,
    loadError: loadError ? String(loadError.message || loadError) : null,
    senders: []
  };
  for (const [name, e] of senders) {
    out.senders.push({
      name, width: e.width, height: e.height, fps: e.fps,
      frames: e.frames, dropped: e.dropped
    });
  }
  return out;
}

async function startSender({ name, width, height, fps }) {
  if (!grandiose) {
    throw new Error(
      'NDI not available: grandiose is not installed/built. ' +
      'Run `npm install` (rebuilds native module) and install the NDI runtime. ' +
      (loadError ? `(${loadError.message})` : '')
    );
  }
  if (senders.has(name)) return; // already running

  // grandiose.send signature varies; try the common shapes.
  let sender;
  const opts = { name, clockVideo: false, clockAudio: false };
  if (typeof grandiose.send === 'function') {
    const r = grandiose.send(opts);
    sender = (r && typeof r.then === 'function') ? await r : r;
  } else {
    throw new Error('grandiose.send is not a function — check grandiose version.');
  }

  senders.set(name, {
    sender, width, height, fps: fps || 30,
    busy: false, frames: 0, dropped: 0
  });
  console.log(`[ndi] sender started: "${name}" ${width}x${height} @${fps}fps`);
}

function stopSender(name) {
  const e = senders.get(name);
  if (!e) return;
  try {
    if (typeof e.sender.destroy === 'function') e.sender.destroy();
    else if (typeof e.sender.close === 'function') e.sender.close();
  } catch (err) {
    console.warn('[ndi] error closing sender', name, err && err.message);
  }
  senders.delete(name);
  console.log(`[ndi] sender stopped: "${name}"`);
}

function stopAll() {
  for (const name of Array.from(senders.keys())) stopSender(name);
}

// Convert RGBA -> BGRA in place (swap R and B bytes).
function rgbaToBgraInPlace(buf) {
  for (let i = 0, n = buf.length; i < n; i += 4) {
    const r = buf[i];
    buf[i] = buf[i + 2];
    buf[i + 2] = r;
  }
}

// meta = { name, width, height, fps }; rgbaBuffer is a Node Buffer (RGBA).
function sendFrame(meta, rgbaBuffer) {
  const e = senders.get(meta.name);
  if (!e || !grandiose) return;

  // Drop frame if the previous async send hasn't completed (back-pressure).
  if (e.busy) { e.dropped++; return; }

  const w = meta.width, h = meta.height, fps = meta.fps || e.fps;
  rgbaToBgraInPlace(rgbaBuffer);

  const frame = {
    type: 'video',
    xres: w,
    yres: h,
    frameRateN: Math.round(fps * 1000),
    frameRateD: 1000,
    fourCC: bgraFourCC(),
    pictureAspectRatio: w / h,
    frameFormatType: progressiveFormat(),
    lineStrideBytes: w * 4,
    data: rgbaBuffer
  };

  try {
    const r = e.sender.video(frame);
    if (r && typeof r.then === 'function') {
      e.busy = true;
      r.then(() => { e.busy = false; e.frames++; })
       .catch((err) => {
         e.busy = false;
         console.warn('[ndi] video() rejected:', err && err.message);
       });
    } else {
      e.frames++;
    }
  } catch (err) {
    e.busy = false;
    console.warn('[ndi] video() threw:', err && err.message);
  }
}

module.exports = {
  isAvailable, status, startSender, stopSender, stopAll, sendFrame
};
