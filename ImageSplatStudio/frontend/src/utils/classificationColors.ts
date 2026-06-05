/** ASPRS LAS classification standard colors (CloudCompare style). */
export const ASPRS_CLASS_NAMES: Record<number, string> = {
  0: "Unclassified",
  1: "Unassigned",
  2: "Ground",
  3: "Low Vegetation",
  4: "Medium Vegetation",
  5: "High Vegetation",
  6: "Building",
  7: "Low Point (Noise)",
  8: "Model Key-point",
  9: "Water",
  10: "Rail",
  11: "Road Surface",
  12: "Overlap Points",
  13: "Wire Guard",
  14: "Wire Conductor",
  15: "Transmission Tower",
  16: "Wire-structure Connector",
  17: "Bridge Deck",
  18: "High Noise",
};

export const ASPRS_CLASS_COLORS: Record<number, [number, number, number]> = {
  0: [0.55, 0.55, 0.55],
  1: [0.45, 0.45, 0.45],
  2: [0.55, 0.35, 0.15],
  3: [0.25, 0.65, 0.25],
  4: [0.15, 0.75, 0.15],
  5: [0.05, 0.55, 0.05],
  6: [0.85, 0.25, 0.25],
  7: [0.95, 0.15, 0.95],
  8: [1.0, 0.85, 0.2],
  9: [0.15, 0.45, 0.95],
  10: [0.6, 0.6, 0.6],
  11: [0.35, 0.35, 0.35],
  12: [0.75, 0.75, 0.75],
  13: [0.9, 0.5, 0.1],
  14: [0.9, 0.7, 0.1],
  15: [0.7, 0.3, 0.3],
  16: [0.5, 0.5, 0.9],
  17: [0.6, 0.4, 0.2],
  18: [1.0, 0.0, 0.0],
};

export const EDITABLE_CLASS_IDS = [2, 3, 4, 5, 6, 7, 9, 11, 0];

export function classColor(classId: number): [number, number, number] {
  return ASPRS_CLASS_COLORS[classId] ?? [
    ((classId * 37) % 255) / 255,
    ((classId * 67) % 255) / 255,
    ((classId * 97) % 255) / 255,
  ];
}

export function className(classId: number, locale: "vi" | "ja" = "vi"): string {
  const en = ASPRS_CLASS_NAMES[classId] ?? `Class ${classId}`;
  if (locale === "ja") {
    const ja: Record<number, string> = {
      0: "未分類",
      2: "地面",
      3: "低植被",
      4: "中植被",
      5: "高植被",
      6: "建物",
      7: "ノイズ",
      9: "水域",
      11: "道路",
    };
    return ja[classId] ?? en;
  }
  const vi: Record<number, string> = {
    0: "Chưa phân loại",
    2: "Mặt đất",
    3: "Thực vật thấp",
    4: "Thực vật trung",
    5: "Thực vật cao",
    6: "Công trình",
    7: "Nhiễu",
    9: "Nước",
    11: "Đường",
  };
  return vi[classId] ?? en;
}

export function applyClassificationColors(
  count: number,
  classifications: Uint8Array | null | undefined,
): Float32Array {
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const cid = classifications ? classifications[i] : 0;
    const [r, g, b] = classColor(cid);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  return colors;
}
