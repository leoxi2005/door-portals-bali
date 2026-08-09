# HANDOFF — Door Portals (touch-wall LiDAR → 5-wall NDI installation, Bali)

> Mở **session Claude Code MỚI** ở `~/door-portals`, cho đọc **file này** thay vì
> tiếp session cũ (tiết kiệm credit). File này là đủ context để làm tiếp.
> ✅ **Đã là git repo trên GitHub:** `leoxi2005/door-portals-bali` (public). `gh` đang đăng nhập tài khoản **leoxi2005**. Sửa xong nhớ `git commit && git push`.

---

## 0. BẮT ĐẦU SESSION MỚI (đọc trước) — cập nhật 2026-08-09

**📋 Câu lệnh dán vào session Claude Code MỚI (mở ở `~/door-portals`):**

> Đọc `HANDOFF.md` ở thư mục này để nắm toàn bộ context dự án Door Portals (touch-wall LiDAR → 5 tường NDI, phòng pentagon Bali). Đây **đã là git repo** trên GitHub `leoxi2005/door-portals-bali` (public, `gh` đã login `leoxi2005`). **TUÂN THỦ quy tắc tiết kiệm credit (mục 12):** không tự chụp screenshot; muốn xem kết quả thì `SNAP_DIR=<dir> RENDER_SCALE=0.5 npm start` (lưu snap1..3.png giây 8/11/15) → downscale → chỉ đưa 1 ảnh khi cần quyết định; gộp nhiều chỉnh vào 1 lần rồi mới render. Chỉ đọc thêm file cụ thể khi cần cho việc đang làm (đừng đọc lại toàn bộ). Xác nhận đã nắm context rồi mình nói việc tiếp.

**Trạng thái hiện tại:**
- **Bản phát hành mới nhất: `v1.0.9`** (2026-08-09) → https://github.com/leoxi2005/door-portals-bali/releases/tag/v1.0.9
  Bản 12 cửa + biển tên + chạm-để-xem. CI Windows đính `Setup .exe` + `-win.zip`.
  ⚠️ **Chưa build `.dmg` macOS cho 1.0.9** — cần thì `npm run build:mac` rồi
  `gh release upload v1.0.9 "release/Door Portals-1.0.9-arm64.dmg"`.
  (v1.0.8 — bản 9 cửa — vẫn còn trên trang releases nếu cần lùi.)
- App LiDAR Bridge (Hokuyo, dự án riêng): **v5.8**, giao thức zone + `/zonecal` đã chốt.
- **Preset LiDAR đã sinh sẵn, chưa ai chạy thật:** xem mục **15**.
- **2026-08-09: 12 cửa + biển tên khách + tương tác chạm-để-xem** — xem mục **17**.
  Code đã xong & đã render kiểm; preset LiDAR 12 zone đã sinh; **sàn đã render lại cho 12 cửa**.
  Đã phát hành **v1.0.9** (chỉ Windows; macOS .dmg chưa build).

**⚠️ VIỆC ON-SITE CÒN NỢ — theo thứ tự ưu tiên:**
1. **Chốt đường xuất NDI nào nhanh hơn trên máy show.** Chạy 1.0.8 hai lần rồi so
   (mục 16): mặc định, và `set NDI_IPC=1`. Lấy **số hình NDI gửi mỗi giây** (số sau
   `DOOR-WALL-1=` tăng bao nhiêu sau mỗi 5 s, chia 5), **không phải fps**. Đường nào
   thắng thì gắn cứng, bỏ đường kia. Mốc cũ: 11.7 NDI/s ở v1.0.6.
2. **Import preset `Very Final - door-portals.json`** (bản 12 zone, 2026-08-09) vào LiDAR Bridge →
   connect 5 sensor → bấm **O** xem gói tới → **Shift+M** xem **12** khung có xanh và trùng ô cửa (mục 15).
3. **Chạm thử cửa TRÁI tường 2** — nếu app mở cửa PHẢI thì trục +x của sensor đó lật.
   ⚠️ Với 3 cửa/tường thì phải **đảo `cua1`↔`cua3`** (cua2 ở giữa nên đứng yên), khác bản 9 cửa.
   **Vị trí không phải tính lại** — cửa bố trí đối xứng qua tâm tường (mục 15).
4. **Warp lại cả 5 nguồn trong MadMapper** — tỉ lệ từng luồng đã khác từ bản 240 cm
   (vd `DOOR-WALL-3` từ 2079 → 1980 px).
5. **Kiểm đa giác `FLOOR`** trong MadMapper AdvancedOutput — nó thò xuống dưới đáy canvas
   ~1100 px, tức ~1/3 sàn có thể ngoài vùng máy chiếu phủ (mục 11b).

**Đã làm ở session 2026-08-08 (dài, nhiều bài học — đọc kỹ nếu định sửa tiếp):**
1. **App đóng gói đứng ở màn hình đen** — `three/examples` bị electron-builder cắt khỏi asar.
   FIX ở v1.0.4, chi tiết ở **bẫy ĐÓNG GÓI** bên dưới.
2. **Shader aurora hỏng âm thầm** (`vUv` → `vMapUv`), đổ 254 lỗi WebGL/giây và aurora chưa
   bao giờ được vẽ. FIX ở v1.0.6, chi tiết ở **bẫy SHADER** bên dưới.
3. **Hiệu năng: 11.7 → chờ đo lại.** Tìm ra nút thắt thật là **IPC**, không phải GPU.
   Toàn bộ số đo + 3 giả thuyết sai đã loại ở **mục HIỆU NĂNG** bên dưới.
4. **Sinh preset LiDAR với 9 zone tính sẵn** từ số đo vật lý + baseline sensor — mục **15**.
5. **Đổi nội dung sau cánh cửa** sang 32 clip DAY5 — mục **6**.

**Đã làm ở session 2026-07-23→24 (tóm tắt để không lặp lại):**
1. **Visual:** thêm **feather mép portal** (inner-shadow recess, `door.js` `makeInnerShadowTexture`/`portalVignette`) + **lớp sao twinkle** (`environment.js` `makeStars`, `config.quality.stars`). ⚠️ **ĐÃ BỎ god-ray/dust khi mở cửa** vì additive mạnh + tăng bloom làm **CHÁY** video — đừng làm lại kiểu đó.
2. **Icon app:** `build/icon.png` (1024²) render từ `scratchpad icon.html` bằng Electron `capturePage`. Trỏ trong `package.json` (`build.icon` + `mac.icon` + `win.icon`). Đổi icon: sửa html → render lại png → build.
3. **Đóng gói & phát hành:** `npm run build:mac` tại máy; **Windows build qua GitHub Actions** (`.github/workflows/release.yml`). Đã loại video backup khỏi bundle & repo (`package.json files` có `!...`, `.gitignore`) → app ~590MB thay vì 1GB.
4. **Overlay kiểm tra zone `/zonecal`** — xem **mục 13**.

**⚠️ Bẫy CI Windows (ĐÃ FIX trong workflow — đừng vấp lại):**
- Runner phải **`windows-2022`** (windows-latest = VS2026 mà `node-gyp 9.4.1` của grandiose không nhận).
- Cần **Python 3.11** (`setup-python`); Python 3.12 làm crash gyp của grandiose.
- Upload `.exe` bằng **`softprops/action-gh-release`** (electron-builder `--publish always` bị conflict "draft vs release" khi release đã tồn tại).
- Module NDI native **`grandiose` KHÔNG cross-build được trên Mac** → Windows bắt buộc build trên CI/máy Windows.

**⚠️ Bẫy ĐÓNG GÓI — app build ra đứng ở màn hình đen "DOOR PORTALS — loading…" (FIX ở v1.0.4):**
- electron-builder có danh sách cứng `topLevelExcludedFiles` (`app-builder-lib/out/util/NodeModuleCopyHelper.js`)
  gồm `test/tests/example/**examples**/.bin` — nó cắt **trước khi** đọc mảng `files` của bạn.
  Nên dù `package.json` ghi `node_modules/three/**/*`, thư mục **`three/examples/` vẫn bị vứt khỏi asar**
  → 5 import `three/addons/postprocessing/*` (EffectComposer/RenderPass/UnrealBloomPass/ShaderPass/OutputPass)
  404 → `src/app.js` chết ngay dòng import → HUD đứng ở chữ tĩnh trong `index.html`. **Hỏng cả Mac lẫn Windows**;
  chạy `npm start` thì không lộ vì `node_modules` nằm nguyên trên đĩa.
- **Cách fix đã dùng:** copy 10 file cần thiết (7 postprocessing + 3 shaders, 29.5 KB, chỉ import thêm `three`)
  vào **`src/vendor/three-addons/`** và trỏ importmap trong `index.html` tới đó. `files` đã có `src/**/*` nên
  không phải sửa `package.json`. **Thêm addon mới → copy vào đây, đừng trỏ lại node_modules.**
- **Kiểm bản build trước khi phát hành:**
  `npx electron-builder --mac --dir` rồi `npx @electron/asar list "release/mac-arm64/Door Portals.app/Contents/Resources/app.asar"`
  — soi xem đủ `src/`, `assets/worlds/pool/` (16), `assets/textures/decor/` (8), `src/vendor/` (10).
  Chạy thử chính bản đóng gói bằng `SNAP_DIR=… RENDER_SCALE=0.35 "release/mac-arm64/Door Portals.app/Contents/MacOS/Door Portals"`
  — thấy log `[ndi] sender started` là renderer đã sống.

**⚡ HIỆU NĂNG — ĐO, ĐỪNG ĐOÁN. Nút thắt là **IPC**, không phải GPU (2026-08-08):**
Log `[perf]` giờ in luôn thời gian từng khâu. Số trên **máy show RTX 5080 / Windows**, full 10350×1080:

| | fps |
|:--|--:|
| `NDI_OFF=1` (chỉ vẽ cảnh, không xuất NDI) | **60.0** (còn bị chặn bởi `maxFps`) |
| Bật NDI (v1.0.6) | **11.7** |

→ Cảnh vẽ chỉ tốn 16.7 ms/frame, riêng khâu xuất NDI ăn **~69 ms**. GPU dư sức, vấn đề nằm ở đường dữ liệu.

Chia nhỏ khâu đó (đo trên M4 Max, `ms/frame` trong log):
`readback:1.7  pack:4.4  ipc:36.6` → **86% là `ipcRenderer.send`**, tức đẩy 45 MB/frame sang main process.
Đọc pixel từ GPU và cắt 5 tường gần như miễn phí.

**3 lần mình đoán sai, ghi lại để khỏi lặp:**
1. Tưởng vòng swizzle RGBA→BGRA là thủ phạm → đo ra **0 khác biệt** (nó chạy ở main process, song song).
2. Tưởng ANGLE/D3D11 chậm → thử `--use-angle=gl / vulkan / d3d11on12` trên máy show: **11.5 / 10 / 11.5**, Vulkan còn không lên hình. Không phải lớp đồ hoạ.
3. Tưởng `readPixels` chậm → thật ra chỉ 1.7 ms.

**Đã sửa (v1.0.5 → v1.0.7):**
- **Ring nhiều PBO** thay vì 1 (mặc định 4, chỉnh bằng `NDI_PBO`) + **vét hết ring mỗi frame**
  (`captureCollect` gọi `collectOne` tới khi hết) — trước đó 1 fence cần ~2 frame mới xong nên
  NDI bị chặn ở nửa tốc độ render dù ring có to bao nhiêu.
- **Gộp lật dọc + cắt cột thành 1 lượt**, bỏ `flippedBuf`.
- **Hai đường xuất NDI, chọn bằng env** — xem `preload.js`:
  mặc định **NDI chạy ngay trong renderer** (không qua IPC); `NDI_IPC=1` quay lại đường cũ.
  ⚠️ **Đây là đánh đổi, không phải thắng tuyệt đối:** trong renderer thì NDI phải giành CPU với
  vòng vẽ. Trên M4 Max đường cũ lại **gửi nhiều hơn** (22 vs 16 hình/giây) dù fps render chỉ bằng
  ¾. Máy nào IPC càng đắt thì đường mới càng lợi → **phải đo trên máy thật rồi mới chốt**.

**Số đo M4 Max để đối chiếu** (full res): tắt NDI 40 fps · IPC + ring 29–32 fps / 22 NDI · in-process 39 fps / 16 NDI.

**Còn dư địa nếu cần 30 NDI/s:** đổi sang **UYVY** (2 byte/pixel thay vì 4) → giảm phân nửa mọi khâu,
nhưng phải chuyển màu YUV trên GPU, rủi ro lệch tông mà màu đã cân kỹ với sàn (mục 11b).

**⚠️ Bẫy SHADER — `onBeforeCompile` hỏng mà KHÔNG ném lỗi (FIX ở v1.0.6):**
`environment.js` (aurora) chèn `vUv.y` vào fragment shader của `MeshBasicMaterial`. Từ **three r152**
các varying uv đã đổi tên theo từng map — `MeshBasicMaterial` **không còn khai báo `vUv`**, phải dùng
**`vMapUv`**. Sai tên thì shader **không link được nhưng app vẫn chạy**: three cứ gọi `useProgram` trên
program hỏng → console đổ **hàng trăm `INVALID_OPERATION: useProgram: program not valid` mỗi giây**
(ANGLE trên Windows tốn hơn Metal nhiều) và **aurora biến mất hoàn toàn** mà không ai để ý.
→ Sửa bất kỳ `onBeforeCompile` nào cũng phải mở Console kiểm, đừng tin "nhìn vẫn chạy".
Nhớ: `assets/audio/*.mp3` báo `ERR_FILE_NOT_FOUND` là **bình thường** — `audio.js` cố tình dò file
tuỳ chọn, không có thì dùng synth (xem đầu `src/audio.js`), không phải lỗi.

**🔧 Công tắc chẩn đoán hiệu năng (env, chạy được cả trên bản đóng gói):**
- `NDI_OFF=1` — tắt hẳn NDI. Chênh lệch fps so với lúc bật = đúng giá của đường readback+IPC trên máy đó.
- `NDI_PBO=1` — quay lại 1 pixel-pack buffer (kiểu trước v1.0.5) để A/B cái ring trên phần cứng thật.
- `NDI_RGBA=1` — gửi RGBA thay BGRA (đo trên Mac: không nhanh hơn).
- `RENDER_SCALE=0.5` — hạ độ phân giải render.

**Ra bản mới (quy trình chuẩn):**
```
# 1. sửa code, test bằng SNAP nếu là visual
# 2. bump "version" trong package.json (vd 1.0.3)
git add -A && git commit -m "..." && git push
npm run build:mac                       # ra release/*.dmg
gh release create v1.0.3 "release/Door Portals-1.0.3-arm64.dmg#macOS (Apple Silicon) .dmg" \
   --title "Door Portals v1.0.3" --notes "..."
# → tag v1.0.3 tự trigger CI build Windows + đính .exe/.zip vào release
```

---

## 1. App là gì (hiện tại)
Electron + Three.js. Cài đặt tương tác cho **phòng pentagon 5 tường** ở Bali:
- Người **chạm 1 lần** vào ô cửa → **cửa mở, chiếu HẾT 1 clip ngẫu nhiên rồi tự đóng**. Chạm lần nữa → clip khác. ("chạm-để-xem", đổi 2026-08-09; bản cũ là "giữ-để-xem".)
- Cảm biến **Hokuyo LiDAR** → app **bridge** (fix-hokuyo-bugs-v5.7, dự án KHÁC) → gửi **OSC** sang app này.
- Output: **5 luồng NDI riêng** (mỗi tường 1 luồng) → **MadMapper** warp lên từng mặt tường vật lý.
- Nền: khu rừng cổ tích đêm — mỗi cửa là 1 "cổng cây thần" (thân cây + ivy + hoa + đom đóm), nền cuốn liền quanh phòng.

*(Lịch sử: từng có concept "ngọn núi/nebula" — ĐÃ BỎ. Đừng làm lại.)*

## 2. Phòng & độ phân giải (số thật từ chủ dự án)
5 tường, **đều cao 240 cm**. Rộng: 180 / 560 / 440 / 500 / 620 cm.
→ px: **810 / 2520 / 1980 / 2250 / 2790** (tổng **10350 × 1080**). Cửa: **1 / 3 / 2 / 3 / 3 = 12 cửa**
(bản 9 cửa cũ là 1/2/2/2/2 — đổi 2026-08-09 để mỗi khách một cửa, xem mục 17).
Thang mét: `M_PER_PX = (hcm/100) / PX_H = 2.40/1080`. Đồng nhất **4.5 px/cm** ở cả 5 tường
và cả chiều cao → 5 vùng cắt NDI trùng khít px thật, không lệch 1 pixel nào.
Chu vi 23.00 m, cửa **185 × 98 cm** (77% chiều cao tường — `DOOR_W/DOOR_H` trong `src/door.js`,
`decor.js` tự co giãn nook cây/ivy/hoa theo `DOOR_H`).

**RESPONSIVE:** mọi thứ (mét, vị trí cửa, vùng cắt NDI) **tự suy ra từ `config.json → walls`**.
Sửa `px`/`hcm`/`doors` 1 tường → toàn bộ tự dãn. `PX_W = tổng px các tường`.

## 3. Cách chạy
- **Full độ phân giải (máy show):** `npm start` (KHÔNG env) → 10350×1080, renderScale 1.0.
- **Preview nhẹ (Mac dev):** `RENDER_SCALE=0.55 npm start` (env override renderScale, main.js:31).
- **Chụp frame nội bộ (khỏi screenshot tốn tiền):** `SNAP_DIR=/path npm start` → lưu snap1..3.png (giây 8/11/15).
- **Test OSC:** gửi `/tuongN/zone/cuaM` int `1`/`0` tới `127.0.0.1:7000`.
- Build show Windows RTX 5080: `npm run build:win` (cần NDI Runtime).

## 4. INPUT — cảm biến (Zone protocol, ĐÃ XONG)
App nghe **cổng UDP 7000** (`config.osc.port`). Bridge bắn:
```
/tuongN/zone/cuaM   1   ← chạm → mở cửa (giữ mở khi còn chạm)
/tuongN/zone/cuaM   0   ← thả → đóng ngay
```
- Auto-map địa chỉ→cửa bằng `config.osc.zoneRule` = `^/tuong(\d+)/zone/cua(\d+)$` → tường N, cửa M.
  (Nếu bridge đặt tên khác → sửa `zoneRule` hoặc điền `config.osc.zones` = `{"địa chỉ": globalDoorIndex}`.)
- `zoneCloseOnRelease: false` (**chạm-để-xem**): gói `0` bị bỏ qua, cửa tự đóng khi clip hết.
  Chạm lại giữa chừng không làm gì (`setOpen` chỉ ăn từ `idle`). Clip pool dài 8.4–16.3 s;
  `timing.overlayMaxHold` (30 s) là lưới an toàn nếu clip treo, `overlayHold` chỉ dùng cho world procedural.
- Xử lý ở `src/app.js` (hàm `resolveZoneDoor` + handler `window.api.onOsc`). Cửa: `Door.setOpen()` + cờ `held`.
- Vẫn giữ song song đường cũ `/touch x y` per-wall-port (9001–9005) làm dự phòng.

## 5. OUTPUT — 5 NDI (ĐÃ XONG, cách "crop")
1 scene render toàn panorama (5 tường ghép liền) → **cắt 5 vùng cột** theo px mỗi tường → **5 sender NDI** `DOOR-WALL-1..5`, đúng tỉ lệ tường.
- Code: `src/app.js` phần "NDI out" (tính `cropX0/cropW/ndiBuf` mỗi wall, `captureCollect()` gửi 5 frame).
- `ndi/sender.js` (grandiose) đã hỗ trợ nhiều sender theo tên; `main.js` route `ndi:frame` theo `meta.name`.
- Camera long-lens (~11° FOV, gần phẳng) → mỗi crop gần chính diện; mapper lo warp.
- **Nâng cấp nếu cần** (méo nhẹ tường rìa on-site): dựng 5 camera chính diện riêng — xem `ARCHITECTURE-5WALL.md §3` (kế hoạch, chưa dựng).

## 6. Video worlds (pool ngẫu nhiên, ĐÃ XONG)
- **Pool 32 clip** ở `assets/worlds/pool/pool01..32.mp4` — bộ **DAY5 mini-scene**
  (nguồn gốc: `~/Downloads/DAY5_TONG_HOP/05_SCENES/`, 8 chủ đề W/H/T/L/F/V/P/B + X).
  Mỗi lần mở cửa → **bốc ngẫu nhiên 1 clip** (ưu tiên clip chưa cửa nào dùng).
  Code: `src/worlds.js` (`POOL_COUNT`, `ensurePool/acquireClip/releaseClip`, class `World.play/pause`).
- **⚠️ Clip là 16:9 NGANG còn cửa là dọc** (98×185 cm, tỉ lệ 0.53) → `coverFit` chỉ hiện
  **dải giữa ~30% bề ngang** mỗi khung. **Đây là chủ ý**: bộ DAY5 bố cục trung tâm (tay trên
  vô lăng, bàn tiệc, phòng nhìn ra cửa sổ) nên cắt giữa lại thành khung dọc mạnh. Đã dựng thử
  và loại 2 phương án khác: **letterbox** để 2 mảng đen chiếm 70% cửa, **nền mờ + letterbox**
  bị đục và clip quá nhỏ. Nếu sau này thay footage **lệch tâm** thì phải thêm offset ngang
  **từng clip**, đừng đổi kiểu fit.
- **Độ nét:** 13 clip 1920×1080, 19 clip 1280×720. Dải nhìn thấy của clip 720p = 381 px trong khi
  cửa trên tường cần 441 px (98 cm × 4.5 px/cm) → hơi mềm một chút, chấp nhận được; clip 1080p thì dư.
- Nạp 32 clip cùng lúc **không tốn fps** (đã đo: 39.6–40.9, y như lúc 16 clip) vì chúng nằm im
  tới khi được chọn.
- Pool cũ (16 clip "đời sống") còn trong lịch sử git nếu cần lấy lại. Video fantasy backup ở
  `assets/worlds_backup_orig/`; `door1..9.mp4` không còn dùng (pool override).

## 7. Decor rừng (per cửa) — `src/decor.js`
- Mỗi cửa: **2 thân cây cổ thụ** ôm 2 bên + **vòm ivy** + **ivy rủ mép cửa** (mờ hẳn khi mở) + **khóm hoa** 2 bên chân (bush-flowers) + đom đóm/bướm.
- Asset cây/ivy/hoa: PNG do **higgsfield** tạo, **chroma-key magenta bằng code** (không dùng AI remover → tránh viền hộp). Nằm ở `assets/textures/decor/` (tree-oak-a/b, tree-willow, tree-oakbroad, tree-slender, canopy-arch, ivy-strand, bush-flowers).
- **QUY TẮC QUAN TRỌNG:**
  - **Decor luôn ở SAU portal** (z < −0.1) → video KHÔNG bao giờ bị che (portal opaque che depth).
  - Cây **pivot ở gốc** + **`fadeBottom`/`fadeFrom`** → rễ tan vào đất, KHÔNG "bật gốc".
    ⚠️ PNG cây **không align đáy** (mỗi file trống một kiểu dưới rễ, `tree-oakbroad` tới 9.3%).
    Đừng đặt `y` bằng tay — luôn qua **`treeBase(name, h)`** (lún = padding×h + 12 cm, và
    `fadeFrom` = padding để alpha về 0 đúng pixel rễ thấp nhất). **Thêm cây mới → phải đo
    padding rồi điền vào bảng `TREE_PAD`** (script đo: PIL, quét alpha từ đáy lên).
  - Nook decor dựng ở **không gian gốc 0.9×1.7 m** (`AUTH_H`) rồi scale 1 lần theo `DOOR_H`
    import từ `door.js` → **đổi cỡ cửa là cây/ivy/hoa tự theo**, đừng sửa tay từng offset.
  - Ivy trước mặt cửa **mờ tức thì** khi mở (openables fade).
- `makeFarTrees()` = cây xa mờ tối (silhouette nền, fadeBottom) tạo chiều sâu quanh cửa dummy.

## 8. Công cụ vận hành on-site (overlay DOM, KHÔNG lọt NDI)
`src/debug-overlay.js` + `src/res-panel.js`:
- **`G`** = HƯỚNG DẪN kết nối cảm biến (Host/Port 7000/tuong-cua/1-0 + quy trình).
- **`O`** = OSC MONITOR (giải thích + log từng gói + "cửa vừa xử lý").
- **`Shift+M`** = BẢN ĐỒ TƯỜNG & ZONE (tường nào = NDI nào = địa chỉ OSC nào; mỗi cửa dán địa chỉ + nháy khi trigger).
- **`R`** = ĐỘ PHÂN GIẢI (gõ px từng tường + cao + tổng → **💾 Lưu → config.json**, khởi động lại để áp dụng).
- Khác: `1-9`=mở cửa, `H`=HUD, `M`=mute.

## 9. Quy trình lắp ở Bali
1. Bridge: **import `Very Final - door-portals.json`** (mục 15) — đã có sẵn 9 zone + prefix `tuong1..5`,
   load xong tự connect 5 sensor. Nếu dựng tay: OSC → host = IP máy door, **port 7000**,
   prefix `tuong1..5`, zone `cua1/cua2`, giá trị 1/0.
2. Chạy `npm start` → bấm **O** kiểm gói tới (lệch tên thì sửa `zoneRule`); bấm **Shift+M** đối chiếu cửa↔địa chỉ.
3. MadMapper: thêm 5 nguồn NDI `DOOR-WALL-1..5` → warp 4 góc mỗi cái lên đúng tường.

**Vị trí cửa thật (để đặt zone bên bridge), tính từ mép TRÁI mỗi tường — bản 12 cửa:**

| Tường | Rộng | Số cửa | Tâm cửa | Zone bridge |
|:--:|:--|:--:|:--|:--|
| 1 | 180 cm | 1 | 90 | 128 cm |
| 2 | 560 cm | 3 | 115.5 / 280 / 444.5 | 128 cm |
| 3 | 440 cm | 2 | 130.3 / 309.7 | 128 cm |
| 4 | 500 cm | 3 | 100.5 / 250 / 399.5 | 128 cm |
| 5 | 620 cm | 3 | 130.5 / 310 / 489.5 | 128 cm |

Cửa rộng 98 cm. **Quy tắc bố trí: khe hở đều nhau** — mọi khoảng trống trên một tường
(2 góc + giữa các cửa) bằng nhau: `khe = (rộng − n×98) / (n+1)`. Đúng công thức mà bản
9 cửa đã dùng (nó ra 0.3/0.7 cho tường 3), nên chỉ cần đổi `n` là ra layout mới.
Khoảng cách tâm-tâm nhỏ nhất là **149.5 cm** (tường 4) > 128 cm nên zone không bao giờ chồng.
Vùng chạm nội bộ của app = cửa + pad 2 bên (tối đa 45 cm, `app.js` tự co) — chỉ dùng cho
đường `/touch` dự phòng; đường zone của bridge mới là đường thật.

## 10. File chính
- `src/app.js` — main: dẫn xuất px/mét từ walls, scene, camera, **render loop + 5 NDI crop**, OSC/zone handler, HUD.
- `src/door.js` — class `Door` (khung/cánh/portal/state machine, `setOpen`, `hitRect`).
  **`DOOR_W=0.98, DOOR_H=1.85` (export, nguồn duy nhất — decor.js import theo)**, `hitPad`
  (app.js set per-wall), yaw 3–7°, portal ôm sát khung `z=-0.025` size `+0.12` (fix "nửa video khác").
- `src/worlds.js` — `World` + **VideoPool** random.
- `src/environment.js` — sky, meadow, fog, **grass (opaque alphaTest 0.5 + alphaToCoverage, cắm gốc)**, dummyDoors (đã kéo lên +0.14), **fireflies (twinkle shader)**, aurora, trees(cành rủ), lanterns, butterflies, groundGlow.
- `src/decor.js` — cổng cây per-door + `makeFarTrees`.
- `config.json` — output, ndi, **walls** (px/wcm/hcm/oscPort/doors), worlds (palette), **osc** (port/zoneRule/zoneCloseOnRelease), timing, quality (bloom 0.42/0.34/0.82, grassBlades 2600, fireflies 420...).
- `main.js` — Electron, OSC receiver (nghe port 7000 + wall ports), NDI IPC, `config:get`/**`config:save`**, RENDER_SCALE/SNAP_DIR env.
- `ndi/sender.js` — multi-sender NDI (grandiose). `preload.js` — api (getConfig/saveConfig/ndi/onOsc).
- `ARCHITECTURE-5WALL.md` — kế hoạch chi tiết 5 tường (một phần đã thay bằng cách "crop").

## 11. Lưu ý / có thể làm tiếp
- **Render giờ 11.2 Mpx** (10350×1080, +44% so bản 220 cm). GPU không phải vấn đề — RTX 5080 vẽ cảnh
  ở 60 fps; nút thắt là đường xuất NDI, xem mục HIỆU NĂNG ở mục 0. Mac dev bắt buộc `RENDER_SCALE`.
- **Đổi số đo tường lần nữa:** chỉ sửa `config.json → walls` (px/wcm/hcm/doors) — mét, vị trí cửa,
  vùng chạm, 5 crop NDI tự suy ra hết. Giữ **px/cm đồng nhất giữa các tường và với chiều cao**
  (hiện 4.5) thì crop NDI mới trùng khít px thật, không lệch pixel.
- Grain đã hạ (0.004), bloom vừa (đừng để chói). Nếu cần chỉnh: `gradePass` grain trong app.js, `bloom*` trong config.
- `mushroomTexture()` trong decor.js giờ **không dùng** (đã bỏ nấm) — dead code, vô hại.
- Sửa độ phân giải bằng panel **R** → cần **khởi động lại app** để áp dụng.
- Nếu tường rìa méo khi chiếu thật → nâng lên **5 camera chính diện** (ARCHITECTURE-5WALL.md §3).

## 11b. VISUAL SÀN (`floor/`) — ĐÃ GIAO 2026-08-01

Sàn **không chạy realtime** — chỉ là **1 video loop 4K** đưa vào MadMapper (output `FLOOR`, 3840×2160).
Code render offline nằm ở **`floor/`**, đọc `config.json → walls` nên đổi số đo tường là sàn tự dãn theo.
Chi tiết đầy đủ ở **`floor/README.md`** (đọc file đó trước khi sửa).

**✅ ĐÃ GIAO — file cuối nằm ở `~/Downloads/DOOR-PORTALS-FLOOR/`:**
`floor.mov` (ProRes 422 HQ, 6.4 GB) + `floor.mp4` (415 MB) + `calib-1.png`.
Cả 3 đều **3840×2160, 30 fps, loop 60.000 s = 1800 frame** (đã ffprobe xác nhận).

- **Concept (bản chốt):** **sàn rừng đêm dưới trăng** — nối tiếp thảm cỏ ở chân 5 tường.
  Nền = **2 ảnh 4096² do higgsfield gen** (`floor/assets/forest.jpg` + `meadow.jpg`, nhìn thẳng từ trên);
  ánh sáng, gió, đom đóm, sương, 9 vùng sáng ấm ở chân cửa đều do shader → loop khít tuyệt đối
  (đã kiểm bằng số: mối nối ≈ đúng bằng bước 1 frame).
- **KHÔNG có mask ngũ giác** — hình tràn kín cả khung 4K, việc cắt theo hình sàn để MadMapper lo
  (chủ dự án chốt). Ngũ giác giờ chỉ dùng để đặt **bố cục** + vẽ ảnh CALIB.
- **⚠️ 2 concept ĐÃ BỎ, đừng làm lại:** (1) "rễ sáng + hồ giữa phòng", (2) đồng cỏ vẽ thuần procedural.
  Cả hai đều bị chê không đẹp / lệch tông. Thứ tạo khác biệt là **ảnh nền thật** — đúng như tường
  dùng PNG higgsfield.

- **⚠️ TỈ LỆ VẬT LÝ — lỗi đã mắc, đừng lặp:** ban đầu lát ảnh nền ở 15.2 m nên **1 chiếc lá to 1.3 m**,
  bị chê ngay *"người nhỏ mà lá cành hoa to, xấu quắc"*. Nay:
  - `geometry.js` chạy chế độ **`fill`**: khung 4K **CHÍNH LÀ** mặt bằng sàn, px/m tính **riêng theo
    2 trục** (x = 3840/8.01 m, y = 2160/7.56 m) → MadMapper kéo khung 16:9 lên sàn gần vuông thì
    hoa lá **tròn trở lại**, không bẹp 1.7 lần.
  - Ảnh nền lát **~2.2 m/ô** ⇒ lá ~20 cm, dương xỉ ~55 cm, bụi cỏ ~25 cm, hoa ~4 cm.
  - Lát nhỏ thì lộ lưới lặp → bẻ toạ độ lát bằng trường nhiễu chậm (`setWarpField`). Bẻ mạnh quá
    (0.85 rad) thì cỏ xoáy như vân tay — giữ ở 0.30 rad / 0.50 ô. Trường bẻ tính **1 lần/pixel**.

- **⚠️ CÂN MÀU KHỚP TƯỜNG — làm bằng số đo, không cảm tính.** Chụp tường thật bằng `SNAP_DIR` rồi đo:

  | | sáng | hue | sat | RGB |
  |:--|--:|--:|--:|:--|
  | tường — dải cỏ chân | 64.2 | 220.7° | 0.30 | 60/62/71 |
  | sàn (bản cuối) | 68.4 | 218.2° | 0.27 | 60/67/78 |
  | tường — sát đáy (chỗ chạm sàn) | 54.6 | | | 40/56/68 |
  | sàn — mép khung (bản cuối) | 55.8 | | | 46/55/66 |

  Bẫy: tường có **R ≈ G**, sàn lúc đầu **G cao hơn R tới 10** → ngả xanh lá, chỏi ngay.
  Sửa ở `shaders.js`: `alb = mix(vec3(lg), alb, 0.72)` + `alb *= vec3(1.02, 0.895, 1.005)`.
  Mép khung còn được ngả xanh-lam + hoa vành ngoài ánh vàng mạnh hơn để nối tiếp dải hoa vàng
  chạy dọc chân tường.
- **Chạy lại:** `./node_modules/.bin/electron floor/main.js --dur 60 --fps 30 --name floor`
  → `floor/out/floor.mov` + `.mp4` (~4,5 phút ở M4 Max, ~7 fps). Soi nhanh: `--still --scale 0.35 --at 0.42`.
  ⚠️ **Chạy foreground**, đừng `nohup ... &` rồi chờ bằng vòng lặp nền — đã 2 lần bị kill giữa chừng,
  ra file thiếu frame (1760/1800, 671/1800). Luôn `ffprobe` kiểm `nb_frames=1800` trước khi giao.
- **Warp:** `--calib` ra `floor/out/calib-1.png` → kéo 4 góc surface tới khi viền trắng trùng chân 5 tường
  (sàn phẳng ⇒ **quad warp là đúng toán**, không cần mesh).
- **Hình học:** 5 bề rộng tường không đủ xác định ngũ giác → dùng **ngũ giác nội tiếp** (duy nhất từ 5 cạnh):
  R = 4.005 m, **34.58 m²**, bbox 8.01×7.56 m, góc 116.3/122.7/102.3/108.1/90.7°.
- **⚠️ Hai phát hiện về ảnh mapping của chủ dự án** (đừng phân tích lại):
  1. Đa giác `FLOOR` trong AdvancedOutput **thò xuống dưới đáy canvas ~1100 px** → khoảng **1/3 sàn
     không nằm trong vùng máy chiếu phủ**. **Phải kiểm tra on-site.**
  2. Giải ngược mặt bằng thật từ đa giác đó + 5 bề rộng tường: **không có nghiệm lồi** → đa giác trong
     MadMapper **không phải outline chính xác của sàn**, không dùng làm chuẩn.
- **Prompt gen ảnh nền** (nano_banana_pro, 1:1, `4k`, 4 credit/ảnh) ghi đầy đủ trong `floor/README.md`.
  Bắt buộc giữ *"flat orthographic overhead view, no sky, no horizon, soft even light with no harsh shadow"* —
  ảnh có bóng đổ mạnh sẵn là hỏng phần chiếu sáng.
- `roots.js` / `meadow.js` là **dead code** của 2 concept đã bỏ.
- `floor/out/` đã .gitignore (file nặng, render lại được). File giao đã chuyển ra `~/Downloads/DOOR-PORTALS-FLOOR/`.
- Đã tốn **8 credit higgsfield** cho 2 ảnh nền (nano_banana_pro 4k, 4 credit/ảnh).

## 12. QUY TẮC TIẾT KIỆM CREDIT (quan trọng — đây là loop chỉnh visual)
- **Screenshot/render là thứ đốt tiền nhất.** Dùng `SNAP_DIR` chụp frame nội bộ → **downscale** → chỉ đưa **1 ảnh** khi cần quyết định. **Gộp nhiều chỉnh vào 1 lần** rồi mới chụp.
- **Mẹo dùng SNAP (đỡ mò lại):**
  - App **KHÔNG tự tạo thư mục** → `mkdir -p $SNAP_DIR` trước, không thì log chỉ báo `[snap] failed: ENOENT`.
  - Ảnh là **capture cả cửa sổ Electron** (~2560×1464), không phải riêng canvas. Canvas nằm
    ở một **dải ngang giữa ảnh** (~y 598–865 khi cửa sổ mặc định) — dò bằng độ sáng hàng rồi
    crop dải đó, phóng 3× mới nhìn rõ chi tiết (gốc cây, mép portal…).
  - HUD in sẵn trên ảnh: `10350x1080@30 render:… fps:…` + danh sách 5 crop NDI → **kiểm tra
    số liệu bằng HUD, khỏi cần thêm ảnh**.
  - `zsh` không có `timeout`; chạy nền rồi `pkill -f "door-portals/node_modules/electron"`.
- Việc cơ học (đổi số/màu) → có thể để model Sonnet; để Opus cho quyết định thẩm mỹ khó.
- 1 session = 1 mục tiêu; xong → `/clear`. Đọc file này để lấy lại context.

## 13. Overlay kiểm tra ZONE khớp cửa (`/zonecal`) — MỚI (v1.0.2)

Mục đích: **thấy zone của bridge có nằm đúng ô cửa không** mà khỏi chạm thử từng cái.

- **Bridge gửi song song** với gói chạm `/tuongN/zone/cuaM 1|0`, tới **cùng IP cổng 7000**:
  ```
  /zonecal/tuongN/cuaM   fx0  fx1  fy0  fy1     ← 4 số FLOAT (OSC type "f") 0..1, ~1 lần/giây
  ```
  - `fx0,fx1` = vị trí zone **dọc theo tường** (0 = mép trái → 1 = mép phải).
  - `fy0,fy1` = **chiều cao**: **0 = đỉnh → 1 = sàn** (quy ước bridge). **App TỰ LẬT** sang world-y (0=sàn, H=đỉnh) — bridge **giữ nguyên**, đừng lật.
- **App xử lý:** `src/app.js` (`zoneCalRe` + `dbg.setBridgeZone`) → `src/debug-overlay.js` (`setBridgeZone`, vẽ trong hàm `draw` của bản đồ **Shift+M**). Khung nét đứt **xanh = trùng cửa, đỏ = lệch**.
- **Dùng:** bấm **Shift+M** → chỉnh vị trí zone bên bridge cho tới khi mọi khung thành xanh.
- **Đã chốt & test bằng gói thật** (fy 0.333/0.889 vẽ đúng dọc). README có code mẫu Python/Node.

## 14. Phân phối / GitHub (chi tiết)

- Repo public: **github.com/leoxi2005/door-portals-bali**. README có hướng dẫn tải + vận hành + kết nối bridge + overlay (hiển thị ngay trang repo).
- Mac build tại máy này (arm64); **chưa ký** → mở lần đầu chuột phải → Open. (Chưa làm Intel x64 / notarize.)
- Windows exe do CI build (`windows-2022` + Python 3.11 + softprops upload). Cần **NDI Runtime** chỉ khi phát NDI ra MadMapper; xem/chạy thường thì không cần.
- `.bak-visual/` = backup local trước khi sửa visual (đã .gitignore, vô hại).
- Icon nguồn: `build/icon.png`. Script render nằm ở scratchpad (`icon.html` + `make-icon.js`) — không commit; nếu cần đổi icon xem mục 0.

---

## 15. PRESET LIDAR ĐÃ SINH SẴN — 12 zone (cập nhật 2026-08-09), chưa chạy thật

**File:** `Very Final - door-portals.json` — nằm ở **`/Volumes/Danh/`** (ổ ngoài) và bản copy ở
**`~/Downloads/`**. Sinh ra từ file mapping của chủ dự án (`Very Final.json`, đã căn warp + chụp
nền xong nhưng `zones` rỗng).

**Chỉ sửa đúng 4 trường, mọi thứ khác giữ nguyên từng byte** (baseline 720 điểm/sensor, devices,
IP, poses, ndiCfg, out, smoothing, placement đều nguyên vẹn — đã diff kiểm):
1. `oscPrefix`: `wall1..5` → **`tuong1..5`** (app lọc bằng `^/tuong(\d+)/zone/cua(\d+)$`, để `wall`
   là rớt sạch gói). Đổi ở bridge nên **không phải build lại app**.
2. `zones`: `[]` → **12 vùng** (1/3/2/3/3), tên `cua1..cua3`, **rộng 128 cm** (ô cửa 98 + 15 cm mỗi bên),
   **cao 30–185 cm**, xoay theo đúng độ nghiêng sàn đo được của từng sensor.
3. `warp.corners`: vẽ lại thành hình chữ nhật tường thật (đáy trên đường sàn đo từ baseline, cao
   2.40 m) để khung `/zonecal` ở Shift+M vẽ đúng chỗ.
4. `bg.subtract`: giữ `true`.

**🔑 Phát hiện quan trọng nhất — `pipeline.js:518` test zone bằng `pointInPoly(t.x, t.y, z.pts)`
trên toạ độ THẾ GIỚI (mét), KHÔNG qua homography.** Nghĩa là **warp kéo lệch không làm cửa mở sai**;
nó chỉ làm khung nét đứt trong overlay Shift+M vẽ sai chỗ, rất dễ tưởng nhầm zone hỏng.
→ Zone tính thẳng từ số đo vật lý, không cần kéo tay trong UI.

**Hình học lắp thật (dựng lại từ `sensorBaselines`, 720 float = 0.5°/bin, `bin i → góc i/720×360°`):**
5 Hokuyo gắn **trên đỉnh mỗi tường, cao 2.455–2.491 m**, quét **mặt phẳng ĐỨNG song song mặt tường**
(không phải quét ngang). Sensor ở gốc (0,0), sàn ở y ≈ −2.47, +x chạy dọc tường. Mỗi sensor lệch
roll 0.1–1.5° → zone đã xoay theo, đừng vẽ thẳng trục. Đáy quad warp của chủ dự án nằm trên đường
sàn trong vòng 1–5 cm (họ căn theo đường sàn), nhưng **mép trái/phải quad là ước lượng bằng mắt**
vì tia laser đi vượt qua góc phòng nên baseline không hề thấy mép tường.

**Gán mặt ↔ tường (chủ dự án đã xác nhận):** Mặt 1→tường 1 … Mặt 5→tường 5.
Sensor: T1=`.14` T2=`.10` T3=`.11` T4=`.12` T5=`.15` (UST-30LC, **thay cho `.13`**).
**Cả 5 sensor gắn giữa bề ngang tường** — chủ dự án xác nhận. Đây là ẩn số duy nhất không suy được
từ dữ liệu; lệch tâm bao nhiêu thì zone tường đó dịch đúng bấy nhiêu.

**Kiểm chứng đã làm:** chiếu ngược 9 zone qua chính `computeH`/`applyH` của bridge → tâm lệch
**0.00 cm** so với cửa app vẽ, dải cao đúng 30–185 cm.

**⚠️ Còn 1 thứ phải kiểm tại chỗ:** chạm cửa **trái** tường 2 xem app mở cửa trái hay phải. Nếu ngược
thì trục +x sensor đó lật → chỉ đổi tên `cua1`↔`cua2`, **vị trí không phải tính lại** (cửa bố trí đối
xứng 0.3/0.7 nên lật trái-phải không đổi toạ độ).

**Sinh lại preset:** script ở scratchpad session (`gen.py`) — đọc `Very Final.json` + `config.json`,
fit đường sàn từ baseline, dựng zone theo `doors` fraction × bề rộng tường, `SENSOR_OFFSET=None`
nghĩa là coi sensor ở giữa tường. Muốn đổi bề rộng zone thì sửa `PAD_MAX` (đang 0.15 m),
đổi dải cao thì sửa `Z_LO/Z_HI` (đang 0.30/1.85).

**Ghi chú thêm:** `out.host` trong preset vẫn là `127.0.0.1` — chỉ đúng nếu bridge chạy **cùng máy**
với Door Portals. Preset có `fusionActive: true` nên **load file xong bridge tự connect cả 5 sensor**
(`renderer.js` cuối hàm `__applyPreset`), baseline cũng tự nạp lại, không phải chụp nền lại.

---

## 17. 12 CỬA + BIỂN TÊN KHÁCH (2026-08-09)

**Layout:** 1 / 3 / 2 / 3 / 3 = **12 cửa**, khe hở đều nhau mỗi tường (bảng ở mục 9).
Sửa duy nhất ở `config.json → walls[].doors`; mét, hit-zone, crop NDI, glow sàn đều tự suy ra.

**Biển tên:** `config.json → doorNames` — mảng 12 chuỗi, thứ tự **trái→phải, tường 1→5**.
Hiện tại: AEON · RALU KANZA CINDY · SANA ROO · ZAM LEVA AMANDEEP · UMER AEINA JP.
(Nguồn: danh sách attendee của chủ dự án; *Umzi* bị gạch nên bỏ.) Thiếu tên → cửa đó
không có biển, không lỗi. Đổi tên chỉ cần sửa config + khởi động lại, không phải build lại.
- Dựng ở `src/door.js` (`nameplateTexture` + khối `if (this.name)` trong `_build`).
- **Bảng gỗ dùng CHÍNH `frameMat` của cửa đó** → tự khớp gỗ/tông của cả 9 palette cửa.
  Canvas chỉ vẽ **phần khắc** (rãnh viền + chữ nhũ vàng) trên nền trong suốt, đè lên bảng.
  ⚠️ Đừng quay lại kiểu vẽ nguyên tấm ván nâu bằng canvas — cửa có 9 màu, tấm ván tự vẽ
  chỉ hợp đúng 1 màu, phần còn lại chỏi.
- Biển nằm **hoàn toàn phía trên ô cửa** (y ≈ 1.96–2.18 m trên tường 2.40 m) nên không
  bao giờ che video. Cao 0.22 m ⇒ **99 px** trên tường thật, chữ ~52 px, đọc thoải mái.
- Phím dev mở cửa giờ là `1..9` rồi `0` `-` `=` cho cửa 10/11/12.

**⚠️ LÁ CHE VIDEO — 3 thủ phạm, đã sửa hết (đừng dựng lại kiểu cũ):**
1. `environment.js` **dải cỏ tiền cảnh** (`grass-bed-1`, z=2.6) cao tới y=0.85 → che **nửa dưới
   mọi ô cửa**. Đã **hạ y −0.10 → −0.52**, chỉ còn ngọn cỏ ~0.43 m làm viền chân cửa.
2. `environment.js` **2 hàng cỏ khóm trước** (z=0.4 và z=2.6) mọc ngẫu nhiên khắp tường.
   Giờ `freeX()` từ chối mọi vị trí rơi vào cột cửa.
3. `environment.js` **`makeTrees` — nhánh lá rủ**, z=+3.8, rộng ~2.8 m, rủ gần chạm sàn.
   Với 12 cửa **không còn khe nào đủ rộng** để đặt ở tiền cảnh → đã **đẩy ra sau cửa (z=−2.4)**.
   Vẫn thấy lá trong khe giữa các cửa, còn khung cửa đục thì che nó đi sạch.
4. `decor.js` khóm hoa chân cửa: trước neo theo **tâm** (`spotX` cố định) nên khóm rộng
   thò vào tới x=0.12 — giờ neo theo **mép trong** (`OUTSIDE_X + w/2`), và z hạ 0.5→0.16.
   Ivy mép cửa cũng dời ra ngoài mép khung.

**🔑 Bẫy hình học quan trọng nhất (dễ mắc lại):** camera là **ống kính dài 60 m** nhìn một
panorama **rộng 23 m**. Vật ở z>0 bị **đẩy ngang** trên màn hình theo
`x_hiện = (x − W/2)·CAM_D/(CAM_D − z) + W/2`. Ở z=3.5, hai đầu phòng bị đẩy tới **0.7 m**.
→ Trồng cây "cạnh cửa" theo toạ độ THẾ GIỚI vẫn có thể rơi trúng ô cửa trên màn hình.
Mọi kiểm tra "có che cửa không" **phải làm trên toạ độ chiếu**, và phải cộng cả **nửa bề
ngang** của chính vật đó. `makeGrass(count, W, doorXs, clearR, camD)` đã làm đúng vậy.

**✅ SÀN ĐÃ RENDER LẠI CHO 12 CỬA (2026-08-09).** File giao mới ở
`~/Downloads/DOOR-PORTALS-FLOOR/`: `floor.mov` (ProRes 6.9 GB) + `floor.mp4` (443 MB) +
`calib-1.png` — cả 3 là 3840×2160 / 30 fps / **1800 frame** (đã `ffprobe` xác nhận).
Bản 9 cửa giữ lại cạnh đó tên `floor-9cua-CU.mov` / `calib-1-9cua-CU.png` (xoá được nếu cần chỗ).
Render mất 4 phút 22 (7.3 fps).
- **Trần số cửa của sàn đã nâng 9 → 12.** Mảng uniform GLSL cần cỡ hằng số nên không suy
  được từ `config.json` lúc chạy: **`#define NDOOR 12` trong `floor/shaders.js`** là nguồn
  duy nhất, `floor/render.js` đọc lại qua `FloorShaders.NDOOR` và cảnh báo ra log nếu
  `config.json` có nhiều cửa hơn. Thêm cửa nữa → sửa đúng con số đó.
- ⚠️ **Ô cửa thừa phải đẩy ra xa** (`DOORM.fill(1e3)`): `0,0` là **giữa phòng**, để nguyên
  là mọc một đốm sáng ấm ngay giữa sàn không ai gọi.
- `floor/calib.js` trước suy số hiệu zone bằng `frac < 0.5 ? 1 : 2` — **sai từ 3 cửa/tường
  trở lên**. Nay đếm theo thứ tự cửa trên chính tường đó (`cua1..cua3`).

**⚡ TƯƠNG TÁC ĐỔI SANG "CHẠM-ĐỂ-XEM" (2026-08-09):**
Chạm **1 lần** → cửa mở, chiếu **hết** clip rồi **tự đóng**. Chạm lần nữa → clip khác.
Buông tay không còn đóng cửa; chạm lại giữa chừng không có tác dụng.
- `config.json → osc.zoneCloseOnRelease: false` (gói `0` của bridge bị bỏ qua).
- `worlds.js`: video pool **`loop = false`** (trước là `true`) + `World.clipDone()`.
  ⚠️ Bật lại `loop` là cửa **không bao giờ đóng** — không có điểm kết để chờ.
- `door.js` state `overlay`: đóng khi `clipDone()` (có sàn 0.6 s chống đóng hụt).
  Không có video (world procedural) → quay về `timing.overlayHold`;
  `timing.overlayMaxHold` = **30 s** là lưới an toàn nếu clip treo.
- Clip pool dài **8.4–16.3 s** nên một lượt xem ≈ 10–18 s kể cả mở/đóng.
  Đổi bộ clip dài hơn thì phải nâng `overlayMaxHold` cho hơn clip dài nhất.

**Preset LiDAR đã sinh lại 12 zone** — xem mục 15.

---

## 16. ĐO HIỆU NĂNG TRÊN MÁY SHOW (quy trình chuẩn)

Mở **Command Prompt ngay trong thư mục đã giải nén**: trong File Explorer, bấm thanh địa chỉ, gõ
`cmd` → Enter. Rồi chạy app từ đó. Xem kết quả: bấm vào cửa sổ app → **Ctrl+Shift+I** → tab
**Console** → dòng `[perf]` in mỗi 5 giây.

```
[perf] fps:11.7  render:10350x1080  ndi sent/dropped: DOOR-WALL-1=248/0 ...  ms/frame: readback:1.7 pack:4.4 ipc:36.6
```

**Con số quan trọng KHÔNG phải `fps`** mà là `DOOR-WALL-1=` tăng bao nhiêu sau mỗi 5 giây, chia 5
→ **số hình NDI thật sự tới MadMapper mỗi giây**. Bản v1.0.4 từng báo 17 fps trong khi NDI chỉ ra
~5 hình/giây; HUD đánh lừa.

Các biến môi trường (gõ `set TÊN=1` rồi Enter, sau đó mới chạy `"Door Portals.exe"`):

| | tác dụng |
|:--|:--|
| `NDI_OFF=1` | tắt hẳn NDI → fps thuần của việc vẽ cảnh. Chênh lệch = giá của đường xuất NDI |
| `NDI_IPC=1` | đẩy NDI qua main process (đường cũ) thay vì chạy trong renderer |
| `NDI_PBO=n` | đổi số pixel-pack buffer (mặc định 4; `1` = kiểu trước v1.0.5) |
| `NDI_RGBA=1` | gửi RGBA thay BGRA (bỏ được vòng đổi kênh màu) |
| `RENDER_SCALE=0.5` | hạ độ phân giải render |

Xoá biến: `set TÊN=` (bỏ trống). Biến chỉ sống trong cửa sổ cmd đó.

Cũng chạy được trên macOS: `NDI_IPC=1 npm start`, log `[perf]` in thẳng ra terminal
(`main.js` bắc cầu `console-message` của renderer ra ngoài).
