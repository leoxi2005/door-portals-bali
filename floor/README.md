# Visual SÀN — Door Portals (phòng pentagon, Bali)

Video **loop** cho mặt sàn, chiếu qua MadMapper (output `FLOOR`, canvas **3840×2160**).
Không chạy realtime, không nhận cảm biến — chỉ là 1 file video phát vòng.

Concept: **sàn rừng đêm dưới trăng** — nối tiếp thảm cỏ ở chân 5 bức tường. Nền là **2 ảnh 4K
do higgsfield gen** (nhìn thẳng từ trên xuống: sàn rừng rêu + đồng cỏ bạc), còn **ánh sáng, gió,
đom đóm, sương, 9 vùng sáng ấm ở chân cửa** đều do shader lo → vẫn loop khít tuyệt đối.

> **Lịch sử: đã bỏ concept "rễ sáng + hồ giữa phòng"** (thuần procedural). Nó chạy được nhưng
> chủ dự án chê không đẹp và lệch tông tường. Đừng làm lại.

---

## Chạy

Chạy từ thư mục gốc repo (`~/door-portals`), dùng luôn Electron của app chính:

```bash
# bản chính thức: 3840×2160, 30 fps, loop 60 s  ->  floor/out/floor.mov + floor.mp4
./node_modules/.bin/electron floor/main.js --dur 60 --fps 30 --name floor

# ảnh tĩnh để soi (rẻ, nhanh) — 3 mốc thời gian trong vòng lặp
./node_modules/.bin/electron floor/main.js --still --scale 0.35 --at 0.0,0.33,0.66 --name chk

# clip xem nhanh
./node_modules/.bin/electron floor/main.js --preview --dur 8 --scale 0.35

# ảnh CALIB để warp trong MadMapper
./node_modules/.bin/electron floor/main.js --calib
```

File ra nằm ở `floor/out/` (đã .gitignore — **không commit**).

### Tham số

| Cờ | Mặc định | Ý nghĩa |
|:--|:--|:--|
| `--w --h` | 3840 2160 | kích thước khung |
| `--scale` | 1.0 | nhân vào w/h (0.25–0.35 để soi nhanh) |
| `--fps --dur` | 30 60 | tốc độ khung / độ dài vòng lặp (giây) |
| `--rot` | 0 | xoay ngũ giác trong khung (độ) |
| `--fit` | 0.90 | ngũ giác chiếm bao nhiêu phần chiều cao khung (phần dư = bleed) |
| `--flip` | — | đảo chiều đi vòng quanh phòng (nếu on-site thấy tường ngược chiều) |
| `--ring` | 2.30 | bán kính khoảng cỏ sáng giữa phòng (m) |
| `--emit` | 0.55 | độ sáng của hoa (bắt theo sắc ấm có sẵn trong ảnh nền) |
| `--bloom --bthresh` | 0.26 0.90 | cường độ / ngưỡng bloom |
| `--bleed` | 0.22 | dải tràn ra ngoài mép ngũ giác trước khi tắt hẳn (m) |
| `--grain --exposure` | 0.010 1.0 | hạt phim / phơi sáng |
| `--flies` | 150 | số đom đóm |
| `--seed` | 20260731 | đổi seed = ra mạng rễ khác |
| `--at` | 0.0,0.33,0.66 | (chế độ `--still`) các mốc pha 0..1 |
| `--show` | — | hiện cửa sổ Electron (gỡ lỗi) |

---

## Hình học sàn — đọc trước khi sửa

**Ngũ giác sàn suy ra từ `../config.json → walls`**, không hard-code. 5 bề rộng tường
(180/560/440/500/620 cm) **không đủ** xác định một ngũ giác, nên dùng **ngũ giác nội tiếp đường tròn**
— với 5 cạnh cho trước hình này là **duy nhất**:

* bán kính vòng ngoại tiếp **4.005 m**, diện tích **34.58 m²**, khung bao **8.01 × 7.56 m**
* góc 5 đỉnh: 116.3° / 122.7° / 102.3° / 108.1° / 90.7°
* mật độ khi fit vào khung 4K: **≈ 2.9 px/cm** (tường là 4.5 px/cm)

Sửa `config.json → walls` là mọi thứ (ngũ giác, 9 vị trí cửa, tỉ lệ) tự dãn theo.
Nếu sau này **đo được góc thật của phòng**, thay mảng đỉnh trong `geometry.js → buildGeometry`.

### Hai điều đã kiểm chứng về ảnh mapping (đừng làm lại)

Ảnh `AdvancedOutput` mà chủ dự án gửi cho thấy hình sàn **nhìn từ máy chiếu** (đã méo phối cảnh),
không phải mặt bằng. Đã fit 5 cạnh của nó, sai số < 1.7 px, ra 5 đỉnh trong canvas 3840×2160:

```
(1924, 30)   (3094, 762)   (1630, 3260)   (1419, 1570)   (758, 468)
```

1. **Đỉnh thứ 3 nằm dưới đáy canvas 1100 px** → khoảng **1/3 sàn không nằm trong vùng máy chiếu phủ**.
   Cần kiểm tra lại on-site: máy chiếu thật sự thiếu, hay chỉ do surface đặt tràn canvas.
2. Thử giải ngược mặt bằng thật từ đa giác đó + 5 bề rộng tường (homography + ràng buộc độ dài):
   **không có nghiệm lồi nào**. → Đa giác trong MadMapper **không phải outline chính xác của sàn**,
   không dùng nó làm chuẩn hình học.

---

## Warp trong MadMapper

1. Chiếu `floor/out/calib-1.png` lên sàn.
2. Kéo 4 góc surface tới khi **viền trắng ngũ giác trùng chân 5 bức tường**.
3. Đối chiếu: **9 vạch đỏ** phải trùng đúng 9 ô cửa; mỗi vạch có dán sẵn địa chỉ OSC tương ứng
   (`/tuongN/zone/cuaM`) để đối chiếu với bản đồ zone của app tường (phím `Shift+M`).
4. Xong thì thay nguồn bằng `floor/out/floor.mov`, bật loop.

Sàn phẳng nên **quad warp (homography) là đúng toán** — không cần mesh warp.

---

## Cấu trúc code

| File | Vai trò |
|:--|:--|
| `geometry.js` | ngũ giác nội tiếp từ `walls`, 9 vị trí cửa, phép chiếu mét → pixel |
| `assets/forest.jpg`, `assets/meadow.jpg` | 2 ảnh nền 4K→2048 do higgsfield gen (xem "Ảnh nền" bên dưới) |
| `roots.js`, `meadow.js` | **dead code** — của 2 concept đã bỏ, giữ lại để tham khảo |
| `shaders.js` | GLSL: scene / đom đóm / bright / blur / composite |
| `render.js` | WebGL2: FBO, bloom 2 tầng, đom đóm additive, đọc pixel → IPC |
| `main.js` | Electron offline: đọc config, spawn ffmpeg, ghi frame thẳng vào stdin |
| `calib.js` | ảnh CALIB |

### Ảnh nền (higgsfield)

2 ảnh sinh bằng `nano_banana_pro`, 1:1, resolution `4k` (4 credit/ảnh), rồi hạ xuống 2048 JPEG:

* `forest.jpg` — *"Perfectly top-down aerial photograph… night forest floor of a Balinese jungle:
  thick emerald moss, damp dark soil, scattered fallen leaves, small moss-covered stones, delicate
  small ferns, tiny pale gold wildflowers, deep indigo-blue moonlight… flat orthographic overhead view"*
* `meadow.jpg` — cùng kiểu nhưng là *night meadow: fine wild grass, clumps of tall grass tufts,
  small mossy rocks, tiny yellow and cream wildflowers, dew drops…*

**Cách map:** mỗi ảnh phủ **đúng 1 lần** cả sàn (`sc = 8.60 m`) → 1 texel ≈ 1 pixel đầu ra,
**không lát, không lặp, không nhoè**. Ảnh B xoay 2.05 rad để khác ảnh A. Trộn A↔B bằng noise +
một số hạng theo bán kính ⇒ giữa phòng là vạt cỏ bạc (khoảng sáng hút mắt), quanh rìa là sàn rừng tối.

Nếu gen ảnh mới: giữ nguyên yêu cầu **"flat orthographic overhead view, no sky, no horizon,
soft even light with no harsh shadow"** — có bóng đổ mạnh sẵn trong ảnh là hỏng phần chiếu sáng.

### Mô hình hình ảnh

Ảnh nền chỉ đóng vai **albedo**. Pháp tuyến giả lấy từ vi phân độ sáng của chính ảnh → ánh trăng
bắt được mặt cỏ. Trên đó chồng: mây trôi che trăng (vệt sáng lớn quét ngang sàn), trăng quay 1 vòng
mỗi chu kỳ, **9 vùng sáng ấm ở chân 9 cửa**, hoa tự phát sáng (bắt theo sắc ấm sẵn có trong ảnh),
sương đọng lấp lánh, sương trôi, đom đóm.

**Gió:** không làm biến dạng hình học mà **uốn nhẹ toạ độ lấy mẫu ảnh** (±4 px ở 4K) theo sóng
chạy ngang sàn ⇒ cỏ trong ảnh đung đưa như thật.

**Bài học đã trả giá:** hai concept thuần procedural trước đó (rễ sáng, rồi đồng cỏ vẽ tay) đều
bị chê. Nền **ảnh thật** là thứ tạo ra khác biệt — giống hệt cách 5 bức tường dùng PNG higgsfield.

### Loop liền mạch

`uT` chạy 0→1 đúng một chu kỳ; **mọi** hàm theo thời gian đều có tần số **nguyên**
(`sin/cos(TAU*k*uT)`, `fract(x - k*uT)`, sương trôi theo vòng tròn). Đã kiểm bằng số:
sai khác giữa frame cuối và frame đầu **bằng đúng** sai khác giữa 2 frame liền nhau.

Muốn kiểm lại:

```bash
for t in 0.0 0.000556 0.999444; do
  ./node_modules/.bin/electron floor/main.js --still --scale 0.25 --at $t --name L$t; done
# rồi so sánh |L0.999444 - L0.0|  với  |L0.000556 - L0.0|  (phải xấp xỉ nhau)
```

---

## Nguyên tắc làm visual cho SÀN (khác hẳn tường)

* Nền tối, sáng bằng điểm nhấn — sàn hắt ngược lên mặt người, chói là hỏng.
* Không chữ, không "hướng trên/dưới": khách đứng vòng quanh nhìn từ mọi phía.
* Chi tiết mềm, tránh nhấp nháy nhanh (người đi lại che, máy quay bị flicker).
* Không để dải sáng sát mép — lộ khe giữa sàn và chân tường.
* Mật độ thực tế ~2.9 px/cm: chi tiết nhỏ hơn ~2 cm là vô nghĩa.
