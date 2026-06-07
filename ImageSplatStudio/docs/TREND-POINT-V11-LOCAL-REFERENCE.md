# Tham chiếu TREND-POINT Ver.11 trên máy local

ImageSplat Studio đang căn chỉnh UI/workflow theo **TREND-POINT Ver.11** (và manual Ver.12).

## Giới hạn Cloud Agent

Agent chạy trên **Linux VM** — **không mở được** TREND-POINT cài trên PC Windows của bạn.  
Để cải tiến sát phần mềm thật, cần **bạn gửi tài liệu tham chiếu** từ máy local (ảnh, log, cấu trúc menu).

## Cách lấy tham chiếu từ TREND-POINT Ver.11 (trên PC bạn)

### Bước A — Chạy script thu thập (Windows)

```powershell
cd ImageSplatStudio
.\scripts\capture-trend-point-reference.ps1
```

Script sẽ:
- Tìm shortcut / thư mục cài TREND-POINT
- Ghi phiên bản file `.exe` (nếu có)
- Tạo `docs/trend-point-captures/report-YYYYMMDD.txt`
- In checklist ảnh cần chụp

### Bước B — Chụp màn hình theo checklist

Lưu vào `ImageSplatStudio/docs/trend-point-captures/`:

| File | Nội dung chụp |
|------|----------------|
| `01-ribbon-tabs.png` | Toàn bộ ribbon (các tab: 表示, 編集, …) |
| `02-data-list.png` | Panel **データ一覧** trái |
| `03-viewport-bar.png` | Thanh trên viewport (透視投影, góc nhìn) |
| `04-status-bar.png` | Status bar dưới (số điểm + X Y Z) |
| `05-grid-panel.png` | Tab lưới / IDW |
| `06-tin-mesh.png` | Tạo **三角網** từ point cloud |
| `07-cross-section.png` | Mặt cắt **断面** |
| `08-trace-surface.png` | **トレース** + 面抽出 (nếu dùng) |

Đặt tên đúng → commit/push hoặc gửi kèm ticket — agent sẽ đối chiếu pixel/layout.

### Bước C — Ghi chú thao tác (nếu không chụp được)

Điền file `docs/trend-point-captures/notes.md`:

```markdown
## Ver.11 trên máy tôi
- Đường cài: C:\...
- Tab ribbon (trái → phải): ...
- Tạo TIN: menu ... → bước 1, 2, 3
- Khác với ImageSplat: ...
```

## Đối chiếu với ImageSplat Studio (hiện tại)

| Hạng mục | TREND-POINT Ver.11 | ImageSplat v0.12.3 | Ghi chú |
|----------|-------------------|---------------------|---------|
| Tab ribbon | 表示/編集/計測/… | 編集/処理/計測 | Cần ảnh Ver.11 để map đủ tab |
| データ一覧 | Trái, checkbox layer | ✅ Panel trái | |
| Viewport bar | 透視投影, preset | ✅ 上から/正面/ホーム | |
| Status bar | Điểm + XYZ | ✅ | |
| 選択 | Thoát lệnh | ✅ + Esc | |
| 三角網 TIN | IDW → mesh | ✅ IDW→TIN | |
| 地理院タイル | Basemap GSI | ❌ (Texture mapping sau) | |
| トレース/面抽出 | Polygon trace | ⏳ Bước 13 manual | |

## Quy trình làm việc (test OK → bước tiếp)

1. Agent implement theo manual + ảnh bạn gửi  
2. **Bạn test** trên PC (ImageSplat + so sánh TREND-POINT cạnh nhau)  
3. Báo OK hoặc chênh lệch cụ thể (tab nào, nút nào, thứ tự bước)  
4. Agent chỉnh **một** chương manual rồi lặp lại  

Xem lộ trình chi tiết: [TREND-POINT-MANUAL-STEPS.md](./TREND-POINT-MANUAL-STEPS.md)

## Link manual công khai

- [サポート — Ver.11 manual](https://const.fukuicompu.co.jp/user/products/trendpoint/manual.html)
- [徹底攻略ガイド (POINT1–12)](https://www.fukuicompu.co.jp/mnl/sos/contents/movie/const/cap/capture_03_tpo.html)
- [基本編 (Smart Online)](https://smart.fukuicompu.co.jp/civil_engineering/tabid101.html?pdid1=56501)
