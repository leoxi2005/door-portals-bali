# HANDOFF — Door Portals (touch-wall LiDAR → 5-wall NDI installation, Bali)

> Mở **session Claude Code MỚI** ở `~/door-portals`, cho đọc **file này** thay vì
> tiếp session cũ (tiết kiệm credit). File này là đủ context để làm tiếp.
> ✅ **Đã là git repo trên GitHub:** `leoxi2005/door-portals-bali` (public). `gh` đang đăng nhập tài khoản **leoxi2005**. Sửa xong nhớ `git commit && git push`.

---

## 0. BẮT ĐẦU SESSION MỚI (đọc trước) — cập nhật 2026-07-24

**📋 Câu lệnh dán vào session Claude Code MỚI (mở ở `~/door-portals`):**

> Đọc `HANDOFF.md` ở thư mục này để nắm toàn bộ context dự án Door Portals (touch-wall LiDAR → 5 tường NDI, phòng pentagon Bali). Đây **đã là git repo** trên GitHub `leoxi2005/door-portals-bali` (public, `gh` đã login `leoxi2005`). **TUÂN THỦ quy tắc tiết kiệm credit (mục 12):** không tự chụp screenshot; muốn xem kết quả thì `SNAP_DIR=<dir> RENDER_SCALE=0.5 npm start` (lưu snap1..3.png giây 8/11/15) → downscale → chỉ đưa 1 ảnh khi cần quyết định; gộp nhiều chỉnh vào 1 lần rồi mới render. Chỉ đọc thêm file cụ thể khi cần cho việc đang làm (đừng đọc lại toàn bộ). Xác nhận đã nắm context rồi mình nói việc tiếp.

**Trạng thái hiện tại:**
- **Bản phát hành mới nhất: `v1.0.2`** → https://github.com/leoxi2005/door-portals-bali/releases
  Đủ 3 file: `.dmg` (macOS ARM), `Setup .exe` + `-win.zip` (Windows). Có icon riêng.
- App LiDAR Bridge (Hokuyo, dự án riêng): đang ở **v5.8** với giao thức zone + `/zonecal` đã chốt.

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
- Người chạm 1 ô cửa trên tường → **cửa mở ra, chiếu 1 video "mảnh đời sống" ngẫu nhiên** → **buông tay → cửa đóng** ("giữ để xem").
- Cảm biến **Hokuyo LiDAR** → app **bridge** (fix-hokuyo-bugs-v5.7, dự án KHÁC) → gửi **OSC** sang app này.
- Output: **5 luồng NDI riêng** (mỗi tường 1 luồng) → **MadMapper** warp lên từng mặt tường vật lý.
- Nền: khu rừng cổ tích đêm — mỗi cửa là 1 "cổng cây thần" (thân cây + ivy + hoa + đom đóm), nền cuốn liền quanh phòng.

*(Lịch sử: từng có concept "ngọn núi/nebula" — ĐÃ BỎ. Đừng làm lại.)*

## 2. Phòng & độ phân giải (số thật từ chủ dự án)
5 tường, **đều cao 220 cm**. Rộng: 220 / 550 / 550 / 530 / 620 cm.
→ px: **831 / 2079 / 2079 / 2003 / 2343** (tổng 9335 × 832). Cửa: **1 / 2 / 2 / 2 / 2 = 9 cửa**.
Thang mét: `M_PER_PX = (hcm/100) / PX_H = 2.20/832`.

**RESPONSIVE:** mọi thứ (mét, vị trí cửa, vùng cắt NDI) **tự suy ra từ `config.json → walls`**.
Sửa `px`/`hcm`/`doors` 1 tường → toàn bộ tự dãn. `PX_W = tổng px các tường`.

## 3. Cách chạy
- **Full độ phân giải (máy show):** `npm start` (KHÔNG env) → 9335×832, renderScale 1.0.
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
- `zoneCloseOnRelease: true` (giữ-để-xem). Cửa mở tối đa 60s an toàn (`timing.overlayMaxHold`) phòng mất gói 0.
- Xử lý ở `src/app.js` (hàm `resolveZoneDoor` + handler `window.api.onOsc`). Cửa: `Door.setOpen()` + cờ `held`.
- Vẫn giữ song song đường cũ `/touch x y` per-wall-port (9001–9005) làm dự phòng.

## 5. OUTPUT — 5 NDI (ĐÃ XONG, cách "crop")
1 scene render toàn panorama (5 tường ghép liền) → **cắt 5 vùng cột** theo px mỗi tường → **5 sender NDI** `DOOR-WALL-1..5`, đúng tỉ lệ tường.
- Code: `src/app.js` phần "NDI out" (tính `cropX0/cropW/ndiBuf` mỗi wall, `captureCollect()` gửi 5 frame).
- `ndi/sender.js` (grandiose) đã hỗ trợ nhiều sender theo tên; `main.js` route `ndi:frame` theo `meta.name`.
- Camera long-lens (~11° FOV, gần phẳng) → mỗi crop gần chính diện; mapper lo warp.
- **Nâng cấp nếu cần** (méo nhẹ tường rìa on-site): dựng 5 camera chính diện riêng — xem `ARCHITECTURE-5WALL.md §3` (kế hoạch, chưa dựng).

## 6. Video worlds (pool ngẫu nhiên, ĐÃ XONG)
- **Pool 16 clip** ở `assets/worlds/pool/pool01..16.mp4` (từ `~/Downloads/Gate_sources`, chủ đề đời sống).
- Mỗi lần mở cửa → **bốc ngẫu nhiên 1 clip** (ưu tiên clip chưa cửa nào dùng). Code: `src/worlds.js` (`ensurePool/acquireClip/releaseClip`, class `World.play/pause`).
- Cover-fit tự động cho clip dọc 9:16 (fill khung). Video cũ (fantasy) backup ở `assets/worlds_backup_orig/`; `door1..9.mp4` không còn dùng (pool override).

## 7. Decor rừng (per cửa) — `src/decor.js`
- Mỗi cửa: **2 thân cây cổ thụ** ôm 2 bên + **vòm ivy** + **ivy rủ mép cửa** (mờ hẳn khi mở) + **khóm hoa** 2 bên chân (bush-flowers) + đom đóm/bướm.
- Asset cây/ivy/hoa: PNG do **higgsfield** tạo, **chroma-key magenta bằng code** (không dùng AI remover → tránh viền hộp). Nằm ở `assets/textures/decor/` (tree-oak-a/b, tree-willow, tree-oakbroad, tree-slender, canopy-arch, ivy-strand, bush-flowers).
- **QUY TẮC QUAN TRỌNG:**
  - **Decor luôn ở SAU portal** (z < −0.1) → video KHÔNG bao giờ bị che (portal opaque che depth).
  - Cây **pivot ở gốc** + **`fadeBottom`** (fade alpha đáy) → rễ tan vào đất, KHÔNG "bật gốc".
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
1. Bridge: OSC → host = IP máy door, **port 7000**, prefix `tuong1..5`, zone `cua1/cua2`, giá trị 1/0.
2. Chạy `npm start` → bấm **O** kiểm gói tới (lệch tên thì sửa `zoneRule`); bấm **Shift+M** đối chiếu cửa↔địa chỉ.
3. MadMapper: thêm 5 nguồn NDI `DOOR-WALL-1..5` → warp 4 góc mỗi cái lên đúng tường.

## 10. File chính
- `src/app.js` — main: dẫn xuất px/mét từ walls, scene, camera, **render loop + 5 NDI crop**, OSC/zone handler, HUD.
- `src/door.js` — class `Door` (khung/cánh/portal/state machine, `setOpen`, `hitRect`). `DOOR_W=0.9, DOOR_H=1.7`, yaw 3–7°, portal ôm sát khung `z=-0.025` size `+0.12` (fix "nửa video khác").
- `src/worlds.js` — `World` + **VideoPool** random.
- `src/environment.js` — sky, meadow, fog, **grass (opaque alphaTest 0.5 + alphaToCoverage, cắm gốc)**, dummyDoors (đã kéo lên +0.14), **fireflies (twinkle shader)**, aurora, trees(cành rủ), lanterns, butterflies, groundGlow.
- `src/decor.js` — cổng cây per-door + `makeFarTrees`.
- `config.json` — output, ndi, **walls** (px/wcm/hcm/oscPort/doors), worlds (palette), **osc** (port/zoneRule/zoneCloseOnRelease), timing, quality (bloom 0.42/0.34/0.82, grassBlades 2600, fireflies 420...).
- `main.js` — Electron, OSC receiver (nghe port 7000 + wall ports), NDI IPC, `config:get`/**`config:save`**, RENDER_SCALE/SNAP_DIR env.
- `ndi/sender.js` — multi-sender NDI (grandiose). `preload.js` — api (getConfig/saveConfig/ndi/onOsc).
- `ARCHITECTURE-5WALL.md` — kế hoạch chi tiết 5 tường (một phần đã thay bằng cách "crop").

## 11. Lưu ý / có thể làm tiếp
- Grain đã hạ (0.004), bloom vừa (đừng để chói). Nếu cần chỉnh: `gradePass` grain trong app.js, `bloom*` trong config.
- `mushroomTexture()` trong decor.js giờ **không dùng** (đã bỏ nấm) — dead code, vô hại.
- Sửa độ phân giải bằng panel **R** → cần **khởi động lại app** để áp dụng.
- Nếu tường rìa méo khi chiếu thật → nâng lên **5 camera chính diện** (ARCHITECTURE-5WALL.md §3).

## 12. QUY TẮC TIẾT KIỆM CREDIT (quan trọng — đây là loop chỉnh visual)
- **Screenshot/render là thứ đốt tiền nhất.** Dùng `SNAP_DIR` chụp frame nội bộ → **downscale** → chỉ đưa **1 ảnh** khi cần quyết định. **Gộp nhiều chỉnh vào 1 lần** rồi mới chụp.
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
