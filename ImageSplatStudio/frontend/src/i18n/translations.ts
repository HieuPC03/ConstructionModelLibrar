export type Locale = "vi" | "ja";

export type TranslationKey = keyof typeof translations.vi;

const translations = {
  vi: {
    appTagline: "3D Reconstruction Studio",
    appTitle: "ImageSplat Studio",
    tabPointCloud: "Point Cloud → 3D Gaussian",
    tabImages: "Ảnh → Gaussian Splat",
    viewerTitle: "Xem mô hình 3D",
    viewerEmptyPc: "Upload point cloud và bấm Tạo hình khối 3D.",
    viewerEmptyImages: "Chọn hoặc tạo một dự án để xem kết quả 3D.",
    statusOpen3d: "Open3D",
    statusGpu: "GPU",
    statusOk: "OK",
    statusNa: "N/A",
    langVi: "Tiếng Việt",
    langJa: "日本語",

    pcTitle: "Point Cloud → Hình khối 3D",
    pcDesc:
      "Chuyển point cloud thành mô hình 3D Gaussian Splatting — hiển thị mượt như Luma AI. Hỗ trợ PLY, TXT, LAS, LAZ, XYZ.",
    pcOpen3dWarn: "Open3D chưa sẵn sàng trên server.",
    projectName: "Tên dự án",
    pcNamePlaceholder: "Ví dụ: Scan công trình",
    qualityLabel: "Chất lượng hình khối 3D",
    qualityLuma: "Luma style — đặc, mượt, khuyến nghị",
    qualityStandard: "Standard — gọn, ít gaussian hơn",
    dropPc: "Kéo thả point cloud hoặc",
    chooseFile: "Chọn file",
    noPcFile: "Chưa chọn file (.ply, .txt, .las, .laz, .xyz...)",
    pcFilesSelected: "tệp đã chọn",
    pcPreviewTitle: "Xem trước Point Cloud",
    pcPreviewLoading: "Đang tải preview...",
    pcPreviewPoints: "điểm",
    pcPreviewShowing: "hiển thị",
    pcPreviewDensity: "Mật độ hiển thị",
    pcPreviewPointSize: "Kích thước điểm",
    pcFormatsHint: "Hỗ trợ: PLY, TXT, LAS, LAZ, XYZ, PCD",
    pcDemo: "Demo (dùng point cloud mẫu)",
    pcSubmit: "Tạo hình khối 3D",
    pcSubmitting: "Đang xử lý...",
    remove: "Xóa",

    imgTitle: "Tạo mô hình 3D từ ảnh",
    imgDesc:
      "Upload 20–100 ảnh chụp quanh vật thể (góc overlap ~60%). Hỗ trợ JPG, PNG, WEBP, TIFF.",
    imgGpuWarn:
      "Máy chủ không có GPU — huấn luyện thật cần CUDA. Bạn vẫn có thể thử Demo nhanh.",
    imgNamePlaceholder: "Ví dụ: Nhà máy Zone A",
    dropImages: "Kéo thả ảnh vào đây hoặc",
    chooseImages: "Chọn ảnh",
    imagesSelected: "ảnh đã chọn",
    noImages: "Chưa chọn ảnh nào",
    selectedImages: "Ảnh đã chọn",
    clearAll: "Xóa tất cả",
    imgDemo: "Demo nhanh (không cần ảnh — xem thử viewer)",
    imgSubmit: "Bắt đầu reconstruction",
    imgSubmitting: "Đang tạo...",
    imgMinError: "Cần ít nhất 3 ảnh JPG/PNG/WEBP (khuyến nghị ≥ 20).",
    imgHeicWarn: "HEIC/HEIF không hỗ trợ — chuyển sang JPG trước khi upload.",
    unsupportedSkipped: "file không hỗ trợ đã bỏ qua",

    projects: "Dự án",
    noProjects: "Chưa có job nào.",
    deleteJob: "Xóa",
    confirmDelete: "Xóa job này?",

    stagePending: "Chờ",
    stageUploading: "Upload",
    stagePreprocessing: "Tiền xử lý",
    stageColmap: "COLMAP",
    stageMeshing: "Tạo mesh",
    stageTraining: "Huấn luyện 3DGS",
    stageExporting: "Xuất file",
    stageCompleted: "Hoàn tất",
    stageFailed: "Lỗi",
    stageCancelled: "Đã hủy",
    typeImages: "Ảnh → Splat",
    typePointcloud: "PC → 3D GS",

    exportReady: "Build hoàn tất",
    exportHint: "Xuất .splat, FBX hoặc gói ZIP đầy đủ",
    exportSplat: "Tải .splat",
    exportFbx: "Xuất FBX",
    exportPackage: "Xuất gói ZIP",
    exportQuick: "Xuất",
  },
  ja: {
    appTagline: "3D再構築スタジオ",
    appTitle: "ImageSplat Studio",
    tabPointCloud: "点群 → 3D Gaussian",
    tabImages: "画像 → Gaussian Splat",
    viewerTitle: "3Dモデルを表示",
    viewerEmptyPc: "点群をアップロードして「3Dボリュームを作成」を押してください。",
    viewerEmptyImages: "プロジェクトを選択または作成して3D結果を表示します。",
    statusOpen3d: "Open3D",
    statusGpu: "GPU",
    statusOk: "OK",
    statusNa: "N/A",
    langVi: "Tiếng Việt",
    langJa: "日本語",

    pcTitle: "点群 → 3Dボリューム",
    pcDesc:
      "点群を3D Gaussian Splattingモデルに変換 — Luma AIのような滑らかな表示。PLY、TXT、LAS、LAZ、XYZ対応。",
    pcOpen3dWarn: "Open3Dがサーバーで利用できません。",
    projectName: "プロジェクト名",
    pcNamePlaceholder: "例: 工事現場スキャン",
    qualityLabel: "3D品質",
    qualityLuma: "Luma style — 高密度・滑らか（推奨）",
    qualityStandard: "Standard — 軽量・ガウシアン少なめ",
    dropPc: "点群をドラッグ＆ドロップまたは",
    chooseFile: "ファイルを選択",
    noPcFile: "未選択 (.ply, .txt, .las, .laz, .xyz...)",
    pcFilesSelected: "ファイル選択済み",
    pcPreviewTitle: "点群プレビュー",
    pcPreviewLoading: "プレビュー読込中...",
    pcPreviewPoints: "点",
    pcPreviewShowing: "表示",
    pcPreviewDensity: "表示密度",
    pcPreviewPointSize: "点サイズ",
    pcFormatsHint: "対応: PLY, TXT, LAS, LAZ, XYZ, PCD",
    pcDemo: "デモ（サンプル点群を使用）",
    pcSubmit: "3Dボリュームを作成",
    pcSubmitting: "処理中...",
    remove: "削除",

    imgTitle: "画像から3Dモデルを作成",
    imgDesc:
      "物体を囲むように20〜100枚の写真をアップロード（オーバーラップ約60%）。JPG、PNG、WEBP、TIFF対応。",
    imgGpuWarn:
      "GPUがありません — 本番トレーニングにはCUDAが必要です。クイックデモをお試しください。",
    imgNamePlaceholder: "例: 工場 Zone A",
    dropImages: "画像をドラッグ＆ドロップまたは",
    chooseImages: "画像を選択",
    imagesSelected: "枚選択済み",
    noImages: "画像未選択",
    selectedImages: "選択した画像",
    clearAll: "すべて削除",
    imgDemo: "クイックデモ（画像不要 — ビューア確認）",
    imgSubmit: "再構築を開始",
    imgSubmitting: "作成中...",
    imgMinError: "JPG/PNG/WEBPの画像を3枚以上必要（推奨20枚以上）。",
    imgHeicWarn: "HEIC/HEIF非対応 — アップロード前にJPGに変換してください。",
    unsupportedSkipped: "件の非対応ファイルをスキップ",

    projects: "プロジェクト",
    noProjects: "ジョブがありません。",
    deleteJob: "削除",
    confirmDelete: "このジョブを削除しますか？",

    stagePending: "待機",
    stageUploading: "アップロード",
    stagePreprocessing: "前処理",
    stageColmap: "COLMAP",
    stageMeshing: "メッシュ",
    stageTraining: "3DGS学習",
    stageExporting: "エクスポート",
    stageCompleted: "完了",
    stageFailed: "エラー",
    stageCancelled: "キャンセル",
    typeImages: "画像 → Splat",
    typePointcloud: "点群 → 3D GS",

    exportReady: "ビルド完了",
    exportHint: ".splat、FBX、またはZIPパッケージをエクスポート",
    exportSplat: ".splatをダウンロード",
    exportFbx: "FBXをエクスポート",
    exportPackage: "ZIPをエクスポート",
    exportQuick: "エクスポート",
  },
} as const;

export { translations };

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale][key] ?? translations.vi[key] ?? key;
}

export const LOCALE_STORAGE_KEY = "imagesplat-locale";

export function loadLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === "vi" || stored === "ja") return stored;
  } catch {
    /* ignore */
  }
  return "vi";
}
