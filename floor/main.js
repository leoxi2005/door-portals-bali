/* Renderer offline cho visual SÀN (Door Portals — phòng pentagon Bali).
 *
 *   node/electron main.js [--still] [--calib] [--preview] [--dur 60] ...
 *
 * Frame đi thẳng từ WebGL -> IPC -> stdin của ffmpeg (không ghi PNG ra đĩa).
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

app.disableHardwareAcceleration && null; // giữ GPU

function argv(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  if (v === undefined || v.startsWith('--')) return true;
  return v;
}
const num = (n, d) => { const v = argv(n, undefined); return v === undefined ? d : parseFloat(v); };
const flag = (n) => process.argv.includes('--' + n);

const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));

const scale = num('scale', 1.0);
const MODE = flag('still') ? 'still' : (flag('calib') ? 'calib' : 'video');
const P = {
  mode: MODE,
  W: Math.round(num('w', 3840) * scale) & ~1,
  H: Math.round(num('h', 2160) * scale) & ~1,
  fps: num('fps', 30),
  dur: num('dur', 60),
  rot: num('rot', 0),
  fit: num('fit', 0.90),
  flip: flag('flip'),
  seed: num('seed', 20260731),
  ring: num('ring', 2.30),
  poolR: num('pool', 0.90),
  emit: num('emit', 0.55),
  flies: Math.round(num('flies', 150)),
  bloom: num('bloom', 0.30),
  bloomThresh: num('bthresh', 0.90),
  bleed: num('bleed', 0.22),
  grain: num('grain', 0.010),
  exposure: num('exposure', 1.0),
  walls: CFG.walls.map((w) => ({ wcm: w.wcm, doors: w.doors })),
  stillTimes: String(argv('at', '0.0,0.33,0.66')).split(',').map(parseFloat),
};

const OUTDIR = path.join(__dirname, 'out');
fs.mkdirSync(OUTDIR, { recursive: true });
const stamp = String(argv('name', MODE === 'video' ? 'floor' : MODE));

let ff = null, frames = 0, t0 = Date.now();

function startFfmpeg() {
  const size = P.W + 'x' + P.H;
  let args = ['-y', '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', size,
    '-framerate', String(P.fps), '-i', 'pipe:0'];
  let outs = [];
  if (MODE === 'still' || MODE === 'calib') {
    args = args.concat(['-vf', 'vflip', '-frames:v', String(MODE === 'still' ? P.stillTimes.length : 1),
      path.join(OUTDIR, stamp + '-%d.png')]);
    outs.push(stamp + '-N.png');
  } else if (flag('preview')) {
    args = args.concat(['-vf', 'vflip', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
      '-pix_fmt', 'yuv420p', path.join(OUTDIR, stamp + '-preview.mp4')]);
    outs.push(stamp + '-preview.mp4');
  } else {
    args = args.concat([
      '-filter_complex', '[0:v]vflip,split=2[a][b]',
      '-map', '[a]', '-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le',
      path.join(OUTDIR, stamp + '.mov'),
      '-map', '[b]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p',
      path.join(OUTDIR, stamp + '.mp4'),
    ]);
    outs.push(stamp + '.mov', stamp + '.mp4');
  }
  console.log('[ffmpeg] ->', outs.join(' + '));
  ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error'].concat(args), { stdio: ['pipe', 'inherit', 'inherit'] });
  ff.on('error', (e) => { console.error('[ffmpeg] lỗi:', e.message); app.exit(1); });
}

function writeFrame(buf) {
  return new Promise((res) => {
    const ok = ff.stdin.write(Buffer.from(buf));
    frames++;
    if (ok) res(); else ff.stdin.once('drain', res);
  });
}

let win;
app.whenReady().then(() => {
  startFfmpeg();
  win = new BrowserWindow({
    width: 900, height: 560, show: flag('show'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      offscreen: false, backgroundThrottling: false,
    },
  });
  win.webContents.on('console-message', (_e, _l, msg) => console.log(msg));
  win.loadFile(path.join(__dirname, 'index.html'), { hash: encodeURIComponent(JSON.stringify(P)) });
});

ipcMain.on('floor:ready', (_e, info) => {
  console.log('[floor] ' + P.W + 'x' + P.H + '  ' + (info.scale / 100).toFixed(2) + ' px/cm  ' +
    'sàn ' + info.area.toFixed(1) + ' m²  rễ ' + info.segCount + ' đoạn  HDR=' + info.hasFloat);
  _e.sender.send('floor:go');
});
ipcMain.handle('floor:frame', (_e, buf) => writeFrame(buf));
ipcMain.on('floor:log', (_e, m) => console.log('[floor] ' + m));
ipcMain.on('floor:fail', (_e, m) => { console.error('[floor] LỖI:\n' + m); app.exit(1); });
ipcMain.handle('floor:done', () => {
  const secs = (Date.now() - t0) / 1000;
  console.log('[floor] xong ' + frames + ' frame trong ' + secs.toFixed(1) + 's');
  ff.stdin.end();
  ff.on('close', () => { console.log('[ffmpeg] đóng. File ở floor/out/'); app.exit(0); });
});
