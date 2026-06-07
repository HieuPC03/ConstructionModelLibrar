# TREND-POINT Manual — Lộ trình chỉnh sửa từng bước

Tham chiếu: [基本編 Smart Online](https://smart.fukuicompu.co.jp/civil_engineering/tabid101.html?pdid1=56501), TREND-POINT Ver.11/12 UI.

**Quy tắc:** Hoàn thành + test OK từng bước trước khi sang bước tiếp.

| # | Manual (基本編) | Trạng thái | Ghi chú |
|---|-----------------|------------|---------|
| 1 | **2. 画面構成** | ✅ v0.12.3 | Layout, status bar, view bar, 選択, データ一覧 |
| 2 | 3. ファイルの読込み・書込み | ⏳ | Import/export LAS, DXF, PLY |
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
