// Editable resolution / layout panel (press R). Lets the operator type each
// wall's pixel width (and the shared height), see the live metres + total, and
// save it back to config.json. Everything in the scene derives from these
// numbers, so after saving + restart the whole visual re-scales to match.
//
// This is the ONE interactive overlay (pointer-events enabled). It is DOM only,
// so it never appears in the NDI feed.

function injectStyle() {
  const s = document.createElement('style');
  s.textContent = `
    #respanel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      font: 13px/1.6 "SF Mono", Menlo, monospace; color: #eaf4ff;
      background: rgba(4, 12, 24, 0.96); padding: 20px 24px; border-radius: 14px;
      z-index: 20; border: 1px solid rgba(120,180,255,0.4);
      box-shadow: 0 12px 44px rgba(0,0,0,0.6); min-width: 460px;
    }
    #respanel h3 { margin: 0 0 4px; color: #ffd98a; font-size: 15px; }
    #respanel .sub { color: #9fb8d8; margin-bottom: 12px; font-size: 11px; }
    #respanel .row { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
    #respanel .row label { width: 92px; color: #cfe9ff; }
    #respanel input {
      width: 84px; background: #0b1830; color: #eaf4ff; border: 1px solid #33507e;
      border-radius: 6px; padding: 5px 8px; font: inherit; text-align: right;
    }
    #respanel input:focus { outline: none; border-color: #7fb0ff; }
    #respanel .meta { color: #8fffc8; font-size: 11px; }
    #respanel .total { margin-top: 10px; padding-top: 10px; border-top: 1px solid #2a3f60; color: #ffd98a; }
    #respanel .btns { margin-top: 14px; display: flex; gap: 10px; }
    #respanel button {
      font: inherit; padding: 8px 16px; border-radius: 8px; border: 0; cursor: pointer;
      background: #2d6cff; color: #fff;
    }
    #respanel button.ghost { background: #24344f; color: #cfe9ff; }
    #respanel .msg { margin-top: 10px; color: #9fffcf; font-size: 12px; min-height: 16px; }
    .dbg-hidden { display: none !important; }
  `;
  document.head.appendChild(s);
}

export function initResPanel({ wallsCfg, PX_H, api }) {
  injectStyle();
  const panel = document.createElement('div');
  panel.id = 'respanel'; panel.className = 'dbg-hidden';
  document.body.appendChild(panel);

  let heightPx = PX_H;
  const hcm = wallsCfg[0]?.hcm ?? 220;

  panel.innerHTML =
    `<h3>ĐỘ PHÂN GIẢI TỪNG TƯỜNG</h3>` +
    `<div class="sub">Gõ chiều rộng (px) mỗi tường · cao dùng chung · scene tự dãn theo · phím R để ẩn</div>` +
    wallsCfg.map((w, i) =>
      `<div class="row">
         <label>Tường ${i + 1}</label>
         <input type="number" id="wpx${i}" value="${w.px}" min="2" step="1">
         <span>px</span>
         <span class="meta" id="wm${i}"></span>
       </div>`).join('') +
    `<div class="row" style="margin-top:8px">
       <label>Chiều cao</label>
       <input type="number" id="hpx" value="${heightPx}" min="2" step="1"><span>px  = ${hcm} cm</span>
     </div>` +
    `<div class="total" id="total"></div>` +
    `<div class="btns">
       <button id="save">💾 Lưu → config.json</button>
       <button class="ghost" id="close">Đóng</button>
     </div>` +
    `<div class="msg" id="msg"></div>`;

  const inputs = wallsCfg.map((_, i) => panel.querySelector('#wpx' + i));
  const hInput = panel.querySelector('#hpx');
  const msg = panel.querySelector('#msg');

  function refresh() {
    const h = Math.max(2, parseInt(hInput.value) || heightPx);
    const mpp = (hcm / 100) / h; // metres per px
    let total = 0;
    inputs.forEach((inp, i) => {
      const px = Math.max(2, parseInt(inp.value) || 0);
      total += px;
      const nDoor = (wallsCfg[i].doors || [0.5]).length;
      panel.querySelector('#wm' + i).textContent = `≈ ${(px * mpp).toFixed(2)} m · ${nDoor} cửa`;
    });
    panel.querySelector('#total').textContent =
      `TỔNG:  ${total} × ${h} px   ·   perimeter ≈ ${(total * mpp).toFixed(2)} m   ·   cao ${(h * mpp).toFixed(2)} m`;
  }
  inputs.forEach(inp => inp.addEventListener('input', refresh));
  hInput.addEventListener('input', refresh);
  refresh();

  panel.querySelector('#save').addEventListener('click', async () => {
    const walls = inputs.map(inp => ({ px: Math.max(2, parseInt(inp.value) || 2) }));
    const output = { height: Math.max(2, parseInt(hInput.value) || heightPx) };
    const res = await api.saveConfig({ walls, output });
    msg.textContent = res.ok
      ? '✅ Đã lưu. ĐÓNG APP & MỞ LẠI (npm start) để áp dụng độ phân giải mới.'
      : '❌ Lỗi lưu: ' + res.error;
  });
  panel.querySelector('#close').addEventListener('click', () => panel.classList.add('dbg-hidden'));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') panel.classList.toggle('dbg-hidden');
  });
}
