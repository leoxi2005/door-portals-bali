// DOOR PORTALS — Electron main process.
// - Owns the NDI sender (ndi/sender.js wraps grandiose)
// - Owns the OSC UDP receiver (osc/receiver.js) and forwards touches to the renderer
// - Loads config.json and hands it to the renderer

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const ndi = require('./ndi/sender');
const osc = require('./osc/receiver');

// Squeeze the most out of the GPU (target machine: RTX 5080).
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let win = null;
let config = null;

function loadConfig() {
  const p = path.join(__dirname, 'config.json');
  try {
    config = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    console.error('[config] failed to read config.json:', err.message);
    config = {};
  }
  // Dev override: RENDER_SCALE=0.3 npm start → preview at 30% resolution
  if (process.env.RENDER_SCALE && config.output) {
    config.output.renderScale = parseFloat(process.env.RENDER_SCALE);
  }
  return config;
}

function createWindow() {
  // Show mode: KIOSK=1 npm start (or output.kiosk in config) → borderless fullscreen
  const kiosk = process.env.KIOSK === '1' || !!(config.output && config.output.kiosk);
  win = new BrowserWindow({
    width: 1280,
    height: 760,
    backgroundColor: '#000000',
    title: 'DOOR PORTALS',
    fullscreen: kiosk,
    frame: !kiosk,
    kiosk,
    autoHideMenuBar: kiosk,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  win.loadFile('index.html');

  // Watchdog: if the renderer dies or hangs mid-show, bring it back.
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[watchdog] renderer gone:', details.reason, '— reloading in 1s');
    setTimeout(() => { if (win && !win.isDestroyed()) win.reload(); }, 1000);
  });
  win.webContents.on('unresponsive', () => {
    console.error('[watchdog] renderer unresponsive — reloading');
    if (win && !win.isDestroyed()) win.reload();
  });

  // Dev aid: SNAP_DIR=/path → save in-app frame grabs (no screen capture needed)
  const snapDir = process.env.SNAP_DIR;
  if (snapDir) {
    [8000, 11000, 15000].forEach((t, i) => setTimeout(async () => {
      try {
        const img = await win.webContents.capturePage();
        fs.writeFileSync(path.join(snapDir, `snap${i + 1}.png`), img.toPNG());
        console.log(`[snap] saved snap${i + 1}.png`);
      } catch (e) { console.error('[snap] failed:', e.message); }
    }, t));
  }
}

app.whenReady().then(() => {
  loadConfig();
  createWindow();

  // OSC in — the bridge's Zone protocol sends everything to ONE port (osc.port,
  // default 7000); legacy per-wall /touch used one port per wall. Listen on both.
  const wallPorts = Array.isArray(config.walls) ? config.walls.map(w => w.oscPort) : [];
  const ports = [...new Set([config.osc?.port, ...wallPorts].filter(Boolean))];
  if (!ports.length) ports.push(9000);
  osc.start(ports, (msg) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('osc:message', msg);
    }
  });
});

ipcMain.handle('config:get', () => config);

// Save resolution/layout edits from the in-app panel back to config.json.
ipcMain.handle('config:save', (_e, partial) => {
  try {
    const p = path.join(__dirname, 'config.json');
    const disk = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (partial.walls) {
      partial.walls.forEach((pw, i) => {
        if (disk.walls[i]) Object.assign(disk.walls[i], pw);
      });
    }
    if (partial.output) disk.output = { ...disk.output, ...partial.output };
    fs.writeFileSync(p, JSON.stringify(disk, null, 2));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('ndi:available', () => ndi.isAvailable());

ipcMain.handle('ndi:start', async (_e, cfg) => {
  try {
    await ndi.startSender(cfg); // { name, width, height, fps }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

ipcMain.handle('ndi:stop', (_e, name) => {
  ndi.stopSender(name);
  return { ok: true };
});

ipcMain.handle('ndi:status', () => ndi.status());

// High-rate video frames (fire-and-forget).
ipcMain.on('ndi:frame', (_e, meta, data) => {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data.buffer || data);
  ndi.sendFrame(meta, buf);
});

app.on('window-all-closed', () => {
  ndi.stopAll();
  osc.stop();
  app.quit();
});

app.on('before-quit', () => {
  ndi.stopAll();
  osc.stop();
});
