# Door Portals

Cài đặt tương tác **touch-wall LiDAR → 5 tường NDI** cho phòng pentagon (Bali).
Chạm một ô cửa trên tường → cửa mở ra, chiếu một "mảnh đời sống" ngẫu nhiên → buông tay → cửa đóng. Electron + Three.js, OSC In (zone), NDI Out (5 luồng).

## Tải về (Download)

Vào tab **[Releases](../../releases)** rồi tải bản mới nhất:

| Máy | File |
|-----|------|
| **macOS** (Apple Silicon) | `Door Portals-*-arm64.dmg` |
| **Windows** | `Door Portals Setup *.exe` |

### macOS
App chưa ký (unsigned) → lần đầu mở: **chuột phải vào app → Open → Open**, hoặc *System Settings → Privacy & Security → Open Anyway*.

### Windows
Chạy file `Setup .exe` để cài. Cần **NDI Runtime** để phát được luồng NDI ra MadMapper.

## Chạy từ source (dev)

```bash
npm install
npm start                    # full 9335×832
RENDER_SCALE=0.55 npm start  # preview nhẹ
```

Xem thêm `HANDOFF.md` cho toàn bộ context (phòng, độ phân giải, OSC zone, NDI crop, decor).

## Build

```bash
npm run build:mac   # .dmg + .zip (chạy trên macOS)
npm run build:win   # .exe (chạy trên Windows — module NDI native build theo OS)
```

> Windows .exe **không** cross-build được trên Mac (module NDI `grandiose` biên dịch riêng theo HĐH). Bản Windows do **GitHub Actions** tự build trên runner Windows và đính vào Releases.

## License

MIT © LEOXI
