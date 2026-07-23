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
Chạy file `Setup .exe` để cài rồi mở như app bình thường — **không cần cài gì thêm** để xem.

> **NDI Runtime là tùy chọn**, chỉ cần trên **máy show thật** khi muốn xuất 5 luồng NDI ra MadMapper để chiếu lên tường. Không có NDI thì app vẫn mở và render đầy đủ, chỉ là không phát luồng NDI ra ngoài.

## Hướng dẫn sử dụng

Chạm một ô cửa trên tường → cửa **mở** ra, chiếu một clip "mảnh đời sống" ngẫu nhiên → **giữ tay** thì cửa mở tiếp, **buông tay** thì cửa đóng ("giữ để xem"). Mỗi tường có (các) cửa riêng, mở độc lập.

### Phím tắt vận hành (chỉ hiện trên màn hình, KHÔNG lọt vào luồng NDI)

| Phím | Chức năng |
|------|-----------|
| **G** | Hướng dẫn kết nối cảm biến (Host / Port / địa chỉ / quy trình) |
| **O** | OSC Monitor — xem từng gói tín hiệu tới + "cửa vừa xử lý" (kiểm tra bridge gửi đúng chưa) |
| **Shift + M** | Bản đồ Tường ↔ Zone ↔ NDI — mỗi cửa dán sẵn địa chỉ OSC, nháy khi nhận tín hiệu |
| **R** | Chỉnh độ phân giải từng tường → **💾 Lưu vào `config.json`** (khởi động lại để áp dụng) |
| **1–9** | Mở thử cửa tương ứng (test không cần cảm biến) |
| **H** | Ẩn/hiện HUD |
| **M** | Tắt/bật tiếng |

---

## Kết nối với app LiDAR Bridge (Hokuyo)

### Luồng tín hiệu

```
Cảm biến Hokuyo LiDAR  →  App LiDAR Bridge (fix-hokuyo-bugs, dự án riêng)
                          → bắn OSC  →  App Door Portals (nghe UDP cổng 7000)
                          → mở/đóng cửa tương ứng
```

App Door Portals **nghe cổng UDP `7000`** (cấu hình ở `config.json → osc.port`). Bridge chỉ cần bắn OSC tới **IP của máy chạy Door Portals**, cổng **7000**.

### Giao thức "Zone" — Bridge phải gửi như thế này

Mỗi khi một ô cửa **có người chạm / hết người chạm**, bridge gửi 1 gói OSC:

```
Địa chỉ:  /tuongN/zone/cuaM
Kiểu:     1 số nguyên (int32)
Giá trị:  1  = đang chạm  → MỞ cửa (giữ mở khi còn chạm)
          0  = buông tay  → ĐÓNG cửa ngay
```

- `N` = số thứ tự **tường** (1..5), `M` = số thứ tự **cửa trong tường đó** (1..2).
- Gửi **`1`** khi bắt đầu có người ở zone, gửi **`0`** khi người rời đi. **Không cần gửi liên tục** — chỉ cần gửi 1 lần khi trạng thái đổi (gửi lặp lại cũng không sao, cửa không bị toggle).
- App tự khớp địa chỉ → cửa bằng luật `osc.zoneRule` = `^/tuong(\d+)/zone/cua(\d+)$`.

#### Ví dụ 1 — kịch bản thực tế (một người chạm cửa 1 của tường 2)

```
# Khách bước tới, tay chạm ô cửa 1 trên tường 2:
/tuong2/zone/cua1   1      ← cửa mở, bắt đầu chiếu clip

#  ... khách giữ tay xem (KHÔNG cần gửi gì thêm, cửa vẫn mở) ...

# Khách buông tay / rời đi:
/tuong2/zone/cua1   0      ← cửa đóng ngay

# Cùng lúc, người khác chạm cửa 2 của tường 3 → độc lập hoàn toàn:
/tuong3/zone/cua2   1
/tuong3/zone/cua2   0
```

> Chỉ gửi khi **đổi trạng thái** (vào zone → `1`, rời zone → `0`). Không cần bắn liên tục. Nếu sợ mất gói `0`, cứ gửi lặp `0` vài lần cũng được — cửa không bị mở lại.

#### Ví dụ 2 — code bridge gửi OSC (Python, thư viện `python-osc`)

```python
from pythonosc.udp_client import SimpleUDPClient

DOOR_APP_IP = "192.168.1.50"   # IP máy chạy Door Portals
client = SimpleUDPClient(DOOR_APP_IP, 7000)

# khi zone (tường 2, cửa 1) có người:
client.send_message("/tuong2/zone/cua1", 1)   # int → mở

# khi zone hết người:
client.send_message("/tuong2/zone/cua1", 0)   # int → đóng
```

Gói vào/ra chung một hàm cho gọn:

```python
def send_zone(wall, door, active):
    client.send_message(f"/tuong{wall}/zone/cua{door}", 1 if active else 0)

send_zone(2, 1, True)    # người vào  → /tuong2/zone/cua1  1
send_zone(2, 1, False)   # người rời  → /tuong2/zone/cua1  0
```

#### Ví dụ 3 — code bridge gửi OSC (Node.js, thư viện `osc`)

```js
const osc = require("osc");
const udp = new osc.UDPPort({ remoteAddress: "192.168.1.50", remotePort: 7000 });
udp.open();

function sendZone(wall, door, active) {
  udp.send({
    address: `/tuong${wall}/zone/cua${door}`,
    args: [{ type: "i", value: active ? 1 : 0 }],   // type "i" = int32 (bắt buộc)
  });
}

sendZone(2, 1, true);    // mở cửa 1 tường 2
sendZone(2, 1, false);   // đóng
```

> ⚠️ Giá trị **phải là int** (`type "i"` / `int32`), không phải float. App đọc `args[0] >= 1` → mở.

### Bản đồ Tường ↔ Cửa ↔ Địa chỉ OSC ↔ Luồng NDI

Theo `config.json` hiện tại (5 tường cao 220 cm, tổng 9 cửa):

| Tường | Rộng | Số cửa | Địa chỉ OSC bridge gửi | Cửa (global) | Luồng NDI |
|:-----:|:----:|:------:|------------------------|:------------:|-----------|
| 1 | 220 cm | 1 | `/tuong1/zone/cua1` | Cửa 1 | `DOOR-WALL-1` |
| 2 | 550 cm | 2 | `/tuong2/zone/cua1`, `/tuong2/zone/cua2` | Cửa 2, 3 | `DOOR-WALL-2` |
| 3 | 550 cm | 2 | `/tuong3/zone/cua1`, `/tuong3/zone/cua2` | Cửa 4, 5 | `DOOR-WALL-3` |
| 4 | 530 cm | 2 | `/tuong4/zone/cua1`, `/tuong4/zone/cua2` | Cửa 6, 7 | `DOOR-WALL-4` |
| 5 | 620 cm | 2 | `/tuong5/zone/cua1`, `/tuong5/zone/cua2` | Cửa 8, 9 | `DOOR-WALL-5` |

> Đổi số tường / số cửa / kích thước trong `config.json → walls` là **toàn bộ tự dãn** (mét, vị trí cửa, vùng cắt NDI). Bảng trên sinh ra từ đó.

### Nếu bridge đặt tên địa chỉ khác

Hai cách trong `config.json → osc`:
1. **Đổi luật** `zoneRule` cho khớp mẫu địa chỉ của bridge (regex, 2 nhóm bắt: `(tường)(cửa)`).
2. **Khai báo tay** từng địa chỉ trong `zones`, ví dụ:
   ```json
   "osc": {
     "zones": {
       "/sensorA/on": 1,
       "/sensorB/on": 2
     }
   }
   ```
   (số = **chỉ số cửa toàn cục** 1..9 theo bảng trên.)

### Test nhanh không cần cảm biến

Gửi OSC bằng bất kỳ công cụ nào (hoặc script) tới `127.0.0.1:7000`:

```
/tuong2/zone/cua1   int 1     # mở cửa 2
/tuong2/zone/cua1   int 0     # đóng cửa 2
```

Rồi bấm **O** trong app để xem gói có tới đúng không, **Shift+M** để đối chiếu cửa ↔ địa chỉ.

### Tùy chọn liên quan (`config.json → osc`)

| Khoá | Ý nghĩa |
|------|---------|
| `port` | Cổng UDP nghe zone (mặc định `7000`) |
| `zoneRule` | Regex khớp địa chỉ → tường/cửa |
| `zoneCloseOnRelease` | `true` = buông tay đóng ngay ("giữ để xem"). `false` = tự phát hết rồi đóng |
| `zones` | Bản đồ địa chỉ → cửa thủ công (khi không dùng zoneRule) |

> Dự phòng: vẫn giữ đường cũ `/touch x y` per-wall (cổng 9001–9005) nếu bridge dùng toạ độ thô thay vì zone.

---

## Xuất hình ra 5 tường (NDI → MadMapper)

App render **1 khung panorama liền 5 tường**, cắt thành **5 vùng cột** đúng tỉ lệ mỗi tường → phát **5 luồng NDI** riêng: `DOOR-WALL-1` … `DOOR-WALL-5`.

Trong **MadMapper** (máy show): thêm 5 nguồn NDI này → warp 4 góc mỗi cái lên đúng mặt tường vật lý.

> Cần cài **NDI Runtime** trên máy show để luồng NDI chạy. Không có NDI thì app vẫn hiển thị bình thường (chỉ không phát ra ngoài).

---

## Quy trình lắp đặt tại chỗ (Bali)

1. **Bridge (Hokuyo):** trỏ OSC về **IP máy Door Portals**, cổng **7000**, prefix `tuong1..5`, zone `cua1/cua2`, giá trị `1`/`0`.
2. **Mở app** → bấm **O** kiểm tra gói OSC tới (lệch tên thì sửa `zoneRule`); bấm **Shift+M** đối chiếu cửa ↔ địa chỉ; bấm **1–9** thử mở cửa tay.
3. **MadMapper:** thêm 5 nguồn NDI `DOOR-WALL-1..5` → warp lên 5 tường.
4. Sai độ phân giải tường thật → bấm **R**, gõ lại px từng tường → **💾 Lưu** → khởi động lại app.

---

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
