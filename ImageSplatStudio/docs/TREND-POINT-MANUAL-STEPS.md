# TREND-POINT Manual — Lộ trình chỉnh sửa từng bước

Tham chiếu:
- [基本編 Smart Online](https://smart.fukuicompu.co.jp/civil_engineering/tabid101.html?pdid1=56501)
- **TREND-POINT Ver.11 cài trên PC local** — xem [TREND-POINT-V11-LOCAL-REFERENCE.md](./TREND-POINT-V11-LOCAL-REFERENCE.md)

**Quy tắc:** Đọc manual → implement → test tuần tự từng chương (không cần screenshot TREND-POINT local).

| # | Manual (基本編) | Trạng thái | Ghi chú |
|---|-----------------|------------|---------|
| 1 | **2. 画面構成** | ✅ v0.12.3 | Layout, status bar, view bar, 選択, データ一覧 |
| 2 | **3. ファイルの読込み・書込み** | ✅ v0.12.5 | Tab ファイル, 読込/書込, PLY, append, per-file export |
| 3 | 4. 座標点管理 | ⏳ | Coord points panel |
| 4 | 5. 座標変換 | ⏳ | CRS, swap XY |
| 5 | 6. 計測 | ⏳ | Distance, area, angle |
| 6 | 7. 編集 | ⏳ | Delete, clip, polygon |
| 7 | 8. 表示 | ⏳ | Color mode, axes, grid display |
| 8 | 9. フィルタリング | ⏳ | Outlier, ground, density |
| 9 | 10. 三角網 | ⏳ | IDW → TIN mesh |
| 10 | 11. 断面 | ⏳ | Cross-section profile |
| 11 | 12. 土量計算 | ⏳ | Cut/fill volume |
| 12 | 13. トレース | ⏳ | Trace / breakline / surface extract |
| 13 | 14. ビューアー | ⏳ | Viewpoints, export viewer |

---

## Bước 1 — 画面構成 (v0.12.3)

### Manual yêu cầu (TREND-POINT)
1. **Ribbon** — tab nhóm lệnh (編集 / 処理 / 計測)
2. **データ一覧** — panel trái, bật/tắt layer
3. **Viewport** — vùng 3D giữa; thanh trên: 透視投影, góc nhìn (上/正面/ホーム)
4. **Status bar** — dưới cùng: **tổng số điểm** + **tọa độ con trỏ X Y Z**
5. **選択** — thoát lệnh đang chạy, về chế độ chọn/quan sát

### Checklist test (làm trên PC sau khi build)

- [ ] Mở tab Point Cloud, load file `.las` hoặc `.ply`
- [ ] Panel trái hiển thị **「データ一覧」** / Danh sách dữ liệu
- [ ] Ribbon có 3 tab: **編集**, **処理**, **計測**
- [ ] Trên viewport: thanh **透視投影** + nút **上から / 正面 / ホーム**
- [ ] Bấm **上から** → camera nhìn từ trên (plan view)
- [ ] Bấm **正面** → camera nhìn mặt trước
- [ ] Bấm **ホーム** → góc nhìn mặc định
- [ ] Di chuột trên viewport → status bar cập nhật **X Y Z** (WCS)
- [ ] Status bar hiển thị tổng số điểm (vd. `16,059,541`)
- [ ] Chọn công cụ vùng → bấm **選択** → về navigate, hint biến mất
- [ ] Phím **Esc** → cũng hủy lệnh (giống 選択)

### Chưa làm ở bước 1 (bước sau)
- Tab 表示 riêng (màu sắc, trục) — chuyển sang Ch.8
- Popup menu chuột phải — Ch.7

---

## Bước 2 — ファイルの読込み・書込み (v0.12.5)

### Manual yêu cầu (TREND-POINT 基本編 Ch.3)
1. **読込** — mở/追加点群: LAS/LAZ, PLY, TXT/XYZ, nhiều file
2. **書込** — xuất point cloud: LAS, TXT, PLY
3. **グループ** — xuất từng file trong データ一覧
4. **TIN/mesh** — xuất OBJ sau khi tạo 三角網

### Đã implement
- Tab ribbon **ファイル** (読込 / 書込)
- **点群読込** — thêm file vào session đang mở (append)
- Tùy chọn **Z反転** cho TXT/XYZ
- Xuất **LAS / TXT / PLY** (toàn bộ điểm đang hiển thị)
- Chọn **từng file** trong dropdown khi có nhiều layer
- **OBJ (TIN)出力** — mesh sau 三角網

### Checklist test
- [ ] Load LAS → tab ファイル → 点群読込 thêm file PLY thứ 2 → データ一覧 có 2 entry
- [ ] Xuất LAS / TXT / PLY → mở lại file bằng phần mềm khác
- [ ] Chọn 1 file trong dropdown → xuất chỉ file đó
- [ ] Tạo TIN → xuất OBJ
- [ ] TXT với Z ngược → bật Z反転 → kiểm tra cao độ

### Chưa làm ở bước 2 (bước sau)
- E57, LAZ nén, DXF/DWG, LandXML — manual nâng cao
- Hộp thoại import (đơn vị, delimiter) — mở rộng sau

