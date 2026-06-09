# TREND-POINT Manual — Lộ trình (hoàn thành v0.13.0)

Tham chiếu: [基本編 Smart Online](https://smart.fukuicompu.co.jp/civil_engineering/tabid101.html?pdid1=56501)

**Quy trình test cuối:** xem [TEST-PROCEDURE-v0.13.md](./TEST-PROCEDURE-v0.13.md)

| # | Manual (基本編) | Trạng thái | Ghi chú |
|---|-----------------|------------|---------|
| 1 | 2. 画面構成 | ✅ v0.12.3 | Layout, ribbon 6 tab, status bar, 選択 |
| 2 | 3. ファイル読込み・書込み | ✅ v0.12.5 | Tab ファイル, append, LAS/TXT/PLY/OBJ |
| 3 | 4. 座標点管理 | ✅ v0.13.0 | Coord tool + Results panel + delete |
| 4 | 5. 座標変換 | ✅ v0.13.0 | Swap XY + CRS; annotation transform fix |
| 5 | 6. 計測 | ✅ v0.13.0 | Distance/area/angle/cross-section + labels |
| 6 | 7. 編集 | ✅ v0.13.0 | Delete/clip/polygon/lasso + undo on clean |
| 7 | 8. 表示 | ✅ v0.13.0 | Tab 表示 — color, axes, IDW surface |
| 8 | 9. フィルタリング | ✅ v0.13.0 | Tab フィルター — outlier/density/ground |
| 9 | 10. 三角網 | ✅ v0.13.0 | IDW→TIN + breakline constraint |
| 10 | 11. 断面 | ✅ v0.13.0 | Width control + profile chart |
| 11 | 12. 土量計算 | ✅ v0.13.0 | Editable base Z + volume history |
| 12 | 13. トレース | ✅ v0.13.0 | Trace polygon → 面抽出 |
| 13 | 14. ビューアー | ✅ v0.13.0 | Viewpoints + viewer JSON export |

## Logic fixes (v0.13.0)

- Volume **base Z** editable (was frozen at mount)
- **Swap XY** re-transforms coord points, measurements, breaklines, regions
- **Undo** before clean outliers and split
- **Breaklines** enforced on IDW grid before TIN
- Measurement **type labels** in Results tab

## Chưa làm (ngoài phạm vi 基本編)

- E57/LAZ/DXF/LandXML I/O
- GSI basemap live tiles (disabled by design)
- Standalone HTML viewer EXE
- Real-time CRS reprojection of coordinates
