# ImageSplat Studio v0.13.0 — Quy trình test cuối (TREND-POINT 基本編)

Test trên **Windows PC** với backend + frontend chạy local. Chuẩn bị file mẫu: `.las` hoặc `.ply` (≥100k điểm khuyến nghị).

---

## 0. Khởi động

```powershell
cd ImageSplatStudio\backend
python -m uvicorn app.main:app --reload --port 8000

# Terminal khác
cd ImageSplatStudio\frontend
npm run dev
```

Mở trình duyệt → tab **Point Cloud** → upload file point cloud.

---

## Ch.2 — 画面構成

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 1 | Quan sát layout | Panel trái **データ一覧**, viewport giữa, property phải, status bar dưới |
| 2 | Ribbon tabs | **ファイル / 編集 / 表示 / フィルター / 処理 / 計測** |
| 3 | View bar | **透視投影**, **上から / 正面 / ホーム** hoạt động |
| 4 | Di chuột viewport | Status bar: số điểm + **X Y Z** |
| 5 | Chọn công cụ → **選択** hoặc **Esc** | Về navigate, hint biến mất |

---

## Ch.3 — ファイル読込み・書込み

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 1 | Tab **ファイル** → **点群読込** thêm file 2 | データ一覧 có 2 layer |
| 2 | Xuất **LAS / TXT / PLY** | File tải về, mở được bằng CloudCompare/QGIS |
| 3 | Dropdown chọn 1 file → xuất | Chỉ điểm file đó |
| 4 | Tạo TIN (Ch.10) → **OBJ (TIN)出力** | File `mesh.obj` hợp lệ |

---

## Ch.4 — 座標点管理

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 1 | Tab **編集** → công cụ **座標点** → click viewport | Điểm xanh hiện trên scene |
| 2 | Property → tab **Results** | Liệt kê coord point + tọa độ |
| 3 | Bấm **×** xóa coord point | Điểm biến mất |

---

## Ch.5 — 座標変換

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 1 | Tab **処理** → **X↔Y入替** | Point cloud đổi trục; annotation (đo/coord) vẫn đúng vị trí |
| 2 | Property → CRS | Đổi EPSG preset, tên CRS cập nhật |

---

## Ch.6 — 計測

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 1 | **距離** — 2 click | Kết quả mét trong console + Results |
| 2 | **面積** — polygon ≥3 điểm → Hoàn tất | Diện tích m² |
| 3 | **角度** — 3 click | Góc ° |
| 4 | **断面** — 2 click trên mặt phẳng | Biểu đồ mặt cắt hiện dưới viewport |

---

## Ch.7 — 編集

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 1 | **点削除** — click gần điểm | Điểm bị xóa |
| 2 | **クリップ** — 2 góc box | Giữ/loại vùng |
| 3 | **ポリゴン削除** — polygon → xóa | Điểm trong vùng mất |
| 4 | **Ctrl+Z / Ctrl+Y** | Undo/redo sau thao tác có snapshot |

---

## Ch.8 — 表示

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 1 | Tab **表示** → đổi chế độ màu | RGB / elevation / classification |
| 2 | Bật/tắt **軸** | Trục WCS hiện/ẩn |
| 3 | Sau tạo IDW grid → **IDW面表示** | Mặt lưới overlay |

---

## Ch.9 — フィルタリング

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 1 | Tab **フィルター** → **ノイズ除去** | Số điểm giảm, undo được |
| 2 | **密度フィルター** | Loại điểm thưa |
| 3 | **地表面フィルター** | Giữ điểm gần mặt đất |

---

## Ch.10 — 三角網

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 1 | Tab **計測** → **IDWグリッド作成** | Grid data OK |
| 2 | Tab **処理** → **地形メッシュ作成 (TIN)** method IDW | Mesh hiện trên viewport |
| 3 | Vẽ **breakline** trên mesh → tạo lại TIN | Mesh bám breakline hơn (cao độ grid tại breakline) |

---

## Ch.11 — 断面

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 1 | Tab **計測** → chỉnh **断面幅** W | Width thay đổi |
| 2 | Công cụ **断面** — 2 điểm | Chart SVG: Z min/max/avg |
| 3 | Kiểm tra stats dưới chart | Z min, max, avg hợp lý |

---

## Ch.12 — 土量計算

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 1 | Có IDW grid → nhập **基準標高 Z₀** tùy ý | Input không bị khóa |
| 2 | **土量計算** | Popup cut/fill/net m³ |
| 3 | Lặp với Z₀ khác | **土量履歴** hiện trên ribbon |

---

## Ch.13 — トレース

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 1 | Có IDW grid | Bắt buộc |
| 2 | Tab **編集** → **トレース** → polygon ≥3 điểm → **面抽出** | Trace mesh (xanh) xuất hiện |
| 3 | Property Results → **トレース面** | Liệt kê trace ID + số tam giác |

---

## Ch.14 — ビューアー

| # | Thao tác | Kỳ vọng |
|---|----------|---------|
| 1 | Property panel → Viewpoints → **保存** | Viewpoint trong list |
| 2 | Click tên viewpoint | Camera nhảy đúng góc |
| 3 | **ビューア出力** | Tải `viewer_package.json` (session + viewpoints) |

---

## Regression — lỗi logic đã sửa (v0.13.0)

| Bug cũ | Cách verify |
|--------|-------------|
| Volume luôn dùng Z min cố định | Đổi Z₀ → cut/fill thay đổi |
| Swap XY làm lệch annotation | Swap XY sau khi đặt coord point → marker vẫn đúng chỗ |
| Measurement label sai (angle→area) | Results tab hiển thị đúng loại |
| Breakline không ảnh hưởng TIN | So sánh mesh trước/sau breakline |
| Clean outliers không undo | Ctrl+Z khôi phục |

---

## Báo lỗi

Ghi rõ: chương manual (#), bước (#), file mẫu, screenshot, message console/backend.
