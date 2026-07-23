# DOOR PORTALS — LiDAR Touch Wall (5 tường / 9335×1080)

Phòng pentagon 5 tường chiếu liền mạch. Mỗi tường: 1 LiDAR riêng + cửa tương tác riêng,
tất cả trong 1 scene panorama. Chạm cửa → cửa mở → "thế giới khác" tràn **riêng tường đó**.

## Chạy

```bash
cd ~/door-portals
npm start                        # full 9335×1080 (máy show / RTX 5080)
RENDER_SCALE=0.35 npm start      # preview nhẹ khi dev trên Mac
```

NDI Out: source `DOOR-PORTALS` (kích thước = render size, full = 9334×1080 even-align).

## Layout 5 tường (config.json → walls)

| Tường | Bề rộng | px | OSC port | Số cửa |
|---|---|---|---|---|
| 1 | 5.01 m | 1900 | 9001 | 2 |
| 2 | 5.54 m | 2101 | 9002 | 2 |
| 3 | 5.54 m | 2101 | 9003 | 2 |
| 4 | 6.10 m | 2318 | 9004 | 2 |
| 5 | 2.41 m | 915  | 9005 | 1 |

Mỗi LiDAR gửi về **port của tường mình**: `/touch x y` (0..1 normalized trong tường đó,
y=0 mép trên; đổi `osc.flipY`/`osc.normalized` nếu app LiDAR khác chuẩn).
Trigger tay: `/door/1`..`/door/9` vào bất kỳ port nào.

## 9 cửa / 9 thế giới (assets/worlds/door1..9.mp4)

1 đồng cỏ nắng · 2 biển mây hoàng hôn · 3 cực quang · 4 đáy biển san hô ·
5 rừng hoa anh đào · 6 đỉnh tuyết bình minh · 7 sa mạc ngân hà · 8 thác nước jungle · 9 dải thiên hà

Thay thế giới nào chỉ cần thay file mp4 đó (16:9, ~10s = overlayHold).
Video chỉ phát 1 lần mỗi lượt mở cửa nên không cần loop.

## Kiến trúc hình ảnh (chống mờ ở 9335px + loop hoàn hảo)

- KHÔNG có video/plate nào bị kéo giãn ra 9335px.
- Sky + dải sương đồi xa: texture 2K **uniform, mirror-repeat** (tile vô hình) + drift chậm.
- Sương mặt đất: **shader fbm procedural** — không có cạnh, trôi vô hạn = tự loop.
- Cửa (9 hero + dummy bay), cỏ billboard, đom đóm: 3D real-time, luôn sắc nét.
- Ambient loop hoàn hảo vì mọi chuyển động nền là procedural.

## Âm thanh

Soundscape procedural (WebAudio, tự loop): gió đêm + dế kêu + chuông gió mơ màng;
cửa mở = whoosh + arpeggio chuông (pan stereo theo vị trí tường), cửa đóng = thud ấm.

- Tắt/bật nhanh: phím `m`. Config: `audio.enabled`, `audio.volume`.
- Muốn dùng SFX thật: thả `ambient.mp3`, `open.mp3`, `close.mp3` vào `assets/audio/`
  — engine tự ưu tiên file, không cần sửa code.

## Dev

- Click chuột = chạm; phím `1..9` = mở cửa; `h` = ẩn/hiện HUD (HUD không dính NDI).
- `SNAP_DIR=/path npm start` → tự lưu snap1..3.png (frame nội bộ, giây 8/11/15).
- Giả lập LiDAR: `node send-touch.js 0.5 0.5 9003` (script trong scratchpad phiên dev).
- Nếu NDI báo "Failed to create sender": còn process Electron cũ giữ tên — kill hết
  Electron của door-portals rồi chạy lại.

## Build

```bash
npm run build:win   # máy show Windows RTX 5080 (cần NDI Runtime)
```

Trên RTX 5080 tăng `quality.*` trong config: grassBlades 3000+, fireflies 250, dummyDoors 40.
