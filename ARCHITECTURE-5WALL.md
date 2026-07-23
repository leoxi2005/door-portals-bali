# Kiến trúc 5-tường — Door Portals cho phòng Pentagon (Bali)

> Mục tiêu: chuyển từ **1 panorama phẳng ghép liền** sang **5 tường visual độc lập,
> đúng tỉ lệ vật lý, xuất 5 luồng NDI riêng**, nhưng **nền rừng vẫn liền mạch cuốn
> quanh phòng**. Mapper (MadMapper/Resolume) lo warp 4 góc vật lý từng tường.

## 0. Quyết định đã chốt
- **Chiếu/mapping:** phần mềm mapper riêng (MadMapper/Resolume/HeavyM) nhận NDI → warp từng tường.
- **Output:** 5 luồng NDI riêng — `DOOR-WALL-1` … `DOOR-WALL-5`, mỗi luồng đúng tỉ lệ tường.
- **Nền:** liền, cuốn quanh phòng pentagon (cây/sương/đom đóm vắt qua góc).
- **Input chạm:** GIỮ NGUYÊN — đã xong (xem §5).

---

## 1. Điều đã có sẵn vs điều phải làm

| Hạng mục | Trạng thái |
|---|---|
| OSC per-wall, normalized 0–1, hit-test cửa | ✅ Đã có (`src/app.js` 256–268) — không đụng |
| Scene rừng, cửa, decor, pool video random | ✅ Tái sử dụng 100% |
| 1 camera panorama xiên toàn cục | ❌ Thay bằng **5 camera tường** |
| 1 canvas + 1 NDI | ❌ Thay bằng **5 render target + 5 NDI** |
| Wall config theo `px` | ❌ Thay bằng **kích thước vật lý (m) + độ phân giải NDI (px)** |
| Bloom/grade 1 lần trên canvas | ❌ Áp **per-wall** |

**Kết luận:** đây là **refactor pipeline render + output**, KHÔNG viết lại thế giới/cửa/logic chạm. ~80% code cũ giữ nguyên.

---

## 2. Mô hình toạ độ — "trải phẳng vành pentagon" (unrolled strip)

Chìa khoá để nền **liền mạch mà không cần dựng pentagon 3D**:

- Coi thế giới là **1 dải ngang dài = chu vi (đã trải phẳng) của vành tường**.
  Tổng chiều rộng dải = `W1 + W2 + W3 + W4 + W5` (mét).
- Cửa + decor + rừng sống trên dải phẳng này (y như hiện tại).
- **Mỗi tường = 1 đoạn liền kề** của dải: tường *i* chiếm `x ∈ [X0_i, X0_i + Wi]`.
- Vì các đoạn kề nhau thuộc **cùng một dải liền** → nội dung **tự liền tại mép**.
  Khi mapper chiếu 2 đoạn lên 2 mặt tường gấp góc ~108°, nội dung **gấp theo góc**
  → cảm giác rừng cuốn quanh phòng. (Không cần biết góc pentagon trong app; mapper lo phần vật lý.)

```
Dải thế giới trải phẳng (perimeter):
|<-- W1 -->|<-- W2 -->|<----- W3 ----->|<- W4 ->|<-- W5 -->|
[  tường1 ][  tường2 ][    tường3     ][ tường4][  tường5 ]
   cam1       cam2         cam3          cam4      cam5      ← 5 camera nhìn chính diện từng đoạn
    │          │            │             │         │
  NDI1       NDI2         NDI3          NDI4      NDI5       ← 5 luồng NDI riêng
```

**Chiều cao dải `Hm`** = chiều cao vùng chiếu trên tường (mét). Xem §6 (cần số liệu).
Nếu **mọi tường cùng `Hm`** → mép nối liền hoàn hảo. Nếu khác `Hm` theo tường → có bậc chiều
cao tại góc (xử lý được, nhưng cần bạn xác nhận — §6).

---

## 3. Camera per-wall (rig)

Mỗi tường 1 camera **perspective nhìn chính diện đoạn của nó** → hết lệch phối cảnh toàn cục
(chính là gốc bug "portal ló" đã gặp), vẫn giữ chiều sâu 3D cho cửa.

Cho tường *i* (đoạn `x∈[X0_i, X0_i+Wi]`, cao `[0, Hm]`):
```
cx = X0_i + Wi/2 ;  cy = Hm/2
D_i = khoảng lùi camera (điều chỉnh độ sâu; vd D_i = max(Wi, Hm) * 1.4)
fovY = 2 * atan( (Hm/2) / D_i )
aspect = Wi / Hm
camera_i.position = (cx, cy, D_i) ; lookAt(cx, cy, 0)
```
- Vì camera **đặt giữa từng tường** → méo trong 1 tường là đối xứng & nhỏ (không còn xiên rìa toàn cục).
- Cửa vẫn có chiều sâu (khung, cánh mở, portal). Góc xoay cửa nhỏ (3–7°) đã set — giữ.
- Tuỳ chọn: nếu muốn tuyệt đối phẳng (mapper tự lo phối cảnh) có thể dùng **orthographic** per-wall
  (cửa vẫn mở 3D nhưng không foreshorten). Mặc định đề xuất **perspective per-wall**.

---

## 4. Pipeline render + NDI (thay đổi cốt lõi)

### 4.1 Render
```
for i in 1..5:
    renderer.setRenderTarget(RT_i)          // WebGLRenderTarget kích thước (outW_i, outH_i)
    render scene bằng camera_i
    (áp bloom + grade lên RT_i — composer per-wall hoặc post pass dùng chung, đổi input)
readback:
    renderer.readRenderTargetPixels(RT_i, ...) → buffer RGBA_i
    gửi IPC 'ndi:frame' với meta { name: `DOOR-WALL-${i}`, width, height } + buffer_i
```
- 5 render pass/khung. RTX 5080 @30fps: dư sức. (Mac preview: nặng → có **chế độ preview** vẽ 5 ô tiled trong 1 cửa sổ để dev, không bật NDI.)
- Bloom/grade: mỗi RT một lần. Có thể tái dùng 1 EffectComposer, chỉ đổi renderTarget/camera mỗi vòng.

### 4.2 NDI (5 sender)
- `main.js` đã hỗ trợ sender có tên (`startSender({name,width,height,fps})`). **Mở 5 sender** lúc khởi động, mỗi cái 1 tên + đúng độ phân giải tường.
- `ipcMain.on('ndi:frame', (meta,data) => ndi.sendFrame(meta,buf))` → dùng `meta.name` route tới đúng sender. (`ndi/sender.js`: quản 1 map các sender theo tên — kiểm tra API grandiose có sẵn.)
- Fps NDI: theo `config.output.fps` (30).

### 4.3 Đồng bộ
- Cả 5 render dùng cùng `clock` → animation nền/decor đồng bộ tuyệt đối giữa các tường (mép nối không lệch pha).

---

## 5. Input chạm (GIỮ NGUYÊN — chỉ xác nhận contract)

Luồng: `Hokuyo → app hokuyo (WARP 4 góc → normalized 0–1) → OSC /touch x y → port riêng mỗi tường → app door`.
App door hiện đã: `walls.find(oscPort==port)` → `x,y (0–1)` → `touchAtMeters(X0_i + x*Wi, ym)` → hit-test cửa.

**Cần xác nhận khớp với app hokuyo (§6.C):** địa chỉ OSC, thứ tự args, `normalized`, chiều `y`/`flipY`, map port↔tường.

*(Không đổi gì trừ khi contract lệch.)*

---

## 6. SỐ LIỆU CẦN BẠN CUNG CẤP (để điền vào config)

### A. Kích thước chiếu + độ phân giải mỗi tường
| Tường | Rộng vùng chiếu (m) | Cao vùng chiếu (m) | Độ phân giải NDI (px) | Số cửa |
|---|---|---|---|---|
| 1 | ? (≈5.30?) | ? | ? (vd 1920×1080) | ? |
| 2 | ? (≈5.27?) | ? | ? | ? |
| 3 | ? (≈6.90?) | ? | ? | ? |
| 4 | ? (≈3.80?) | ? | ? | ? |
| 5 | ? (≈5.24?) | ? | ? | ? |

- Rộng: lấy từ bản vẽ (xác nhận đúng 5 cạnh nào).
- **Cao vùng chiếu:** phần tường thực sự chiếu hình (toàn bộ tường? hay 1 dải cao ~2–2.5m?). **Mọi tường cùng chiều cao chiếu không?** (nên cùng, để nền liền).
- Độ phân giải NDI mỗi tường = độ phân giải máy chiếu tường đó (hoặc mapper mong muốn).

### B. Bố cục cửa
- Giữ 2/2/2/2/1 = 9 cửa hay đổi? Vị trí cửa trên mỗi tường (giữa? theo `doorFracs`?).

### C. Contract OSC với app hokuyo (fix-hokuyo-bugs-v5.7)
- Địa chỉ (mặc định `/touch`), args `[x, y]` hay khác?
- `x,y` đã normalized 0–1 trong từng tường? Gốc `y` ở đâu (mép trên = 0?)?
- Port ↔ tường: 9001→T1 … 9005→T5 đúng chưa?
- **Có thể cho tôi xem đoạn code gửi OSC của app hokuyo** để chốt 100% (hoặc dán 1 message mẫu).

---

## 7. Các bước triển khai (sau khi có số liệu)

1. **config.json:** đổi `walls[]` sang `{ widthM, heightM, outW, outH, oscPort, doors[] }`; bỏ `px`. Suy ra `X0_i`, `Wm_i`, `Hm`.
2. **Camera rig:** tạo 5 camera per-wall (§3) thay camera panorama.
3. **Render targets + loop:** 5 `WebGLRenderTarget`, vòng render 5 lần, post per-wall.
4. **NDI 5 sender:** mở 5 sender theo tên; route `ndi:frame` theo `meta.name`; readback per-RT.
5. **Preview mode (dev):** vẽ 5 ô tiled ra 1 canvas để soi trên Mac (không NDI).
6. **Rà touch:** verify OSC per-wall vẫn đúng sau khi đổi toạ độ.
7. **Kiểm thử mép nối:** cây/sương vắt qua ranh 2 tường phải liền (render 2 tường kề, ghép thử).

---

## 8. Rủi ro & lưu ý
- **Hiệu năng readback:** 5× `readRenderTargetPixels` mỗi khung. RTX 5080 ổn; nếu nghẽn → PBO/async readback.
- **Mép nối & góc:** app xuất nội dung liền; **blend/che mép do mapper** (soft-edge tại góc nếu cần). App không làm blend góc.
- **Chiều cao chiếu khác nhau giữa các tường** → nếu khác, nền có bậc tại góc; nên thống nhất `Hm`.
- **Máy show Windows RTX 5080:** cần NDI Runtime; build `npm run build:win` như cũ.
- **Calib on-site:** app xuất 5 NDI cố định tỉ lệ → mapper kéo 4 góc từng tường (khớp với bước "WARP" bạn đã quen).

---

## 9. Cần bạn chốt để tôi code
1. Điền bảng §6.A (kích thước + độ phân giải + số cửa mỗi tường).
2. Chiều cao chiếu: các tường có **cùng** không?
3. §6.C: xác nhận/đưa code OSC app hokuyo.
4. Camera per-wall: **perspective** (đề xuất) hay **orthographic** (phẳng tuyệt đối)?
