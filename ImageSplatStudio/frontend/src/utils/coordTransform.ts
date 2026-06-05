/** World ↔ viewer coordinate transforms (matches pipeline/pointcloud_transform.py). */

export interface NormMeta {
  center?: number[];
  scale?: number;
  axis_fix?: string;
  world_min?: number[];
  world_max?: number[];
}

function legacyYUp(meta: NormMeta): boolean {
  return meta.axis_fix === "z_up_to_y_up";
}

export function worldToViewer(
  world: [number, number, number],
  meta: NormMeta,
  swapXy = false,
): [number, number, number] {
  let [wx, wy, wz] = world;
  if (swapXy) [wx, wy] = [wy, wx];
  const center = meta.center ?? [0, 0, 0];
  const scale = meta.scale ?? 1;
  const cx = wx - center[0];
  const cy = wy - center[1];
  const cz = wz - center[2];
  if (legacyYUp(meta)) {
    return [cx * scale, cz * scale, -cy * scale];
  }
  return [cx * scale, cy * scale, cz * scale];
}

export function viewerToWorld(
  viewer: [number, number, number],
  meta: NormMeta,
  swapXy = false,
): [number, number, number] {
  const scale = meta.scale ?? 1;
  const center = meta.center ?? [0, 0, 0];
  const [vx, vy, vz] = viewer;
  let cx: number;
  let cy: number;
  let cz: number;
  if (legacyYUp(meta)) {
    cx = vx / scale;
    cy = -vz / scale;
    cz = vy / scale;
  } else {
    cx = vx / scale;
    cy = vy / scale;
    cz = vz / scale;
  }
  let ox = cx + center[0];
  let oy = cy + center[1];
  const oz = cz + center[2];
  if (swapXy) {
    return [oy, ox, oz];
  }
  return [ox, oy, oz];
}

export function formatWorldCoords(p: [number, number, number], decimals = 3): string {
  return `${p[0].toFixed(decimals)}, ${p[1].toFixed(decimals)}, ${p[2].toFixed(decimals)}`;
}

export function isJapanGeographic(meta: NormMeta): boolean {
  const c = meta.center ?? meta.world_min;
  if (!c || c.length < 2) return false;
  return c[0] >= 122 && c[0] <= 154 && c[1] >= 24 && c[1] <= 46;
}

export interface CrsPreset {
  epsg: number;
  name: string;
  category: string;
}

const JGD2011_PLANE_NAMES: Record<number, string> = {
  6669: "01",
  6670: "02",
  6671: "03",
  6672: "04",
  6673: "05",
  6674: "06",
  6675: "07",
  6676: "08",
  6677: "09",
  6678: "10",
  6679: "11",
  6680: "12",
  6681: "13",
  6682: "14",
  6683: "15",
  6684: "16",
  6685: "17",
  6686: "18",
  6687: "19",
};

function jgd2011Planes(): CrsPreset[] {
  return Object.entries(JGD2011_PLANE_NAMES).map(([epsg, no]) => ({
    epsg: Number(epsg),
    name: `Japan Geodetic Datum 2011 Plane No. ${no}`,
    category: "Japan-GSI-JGD2011",
  }));
}

export const CRS_PRESETS: CrsPreset[] = [
  { epsg: 6668, name: "JGD2011 (Latitude-Longitude)", category: "Japan-GSI-JGD2011" },
  ...jgd2011Planes(),
  { epsg: 4326, name: "WGS84", category: "Other" },
  { epsg: 0, name: "Local / Unknown", category: "Other" },
];

export const CRS_CATEGORIES = ["Japan-GSI-JGD2011", "Other"] as const;

export function crsNameForEpsg(epsg: number): string {
  const found = CRS_PRESETS.find((c) => c.epsg === epsg);
  return found?.name ?? (epsg > 0 ? `EPSG:${epsg}` : "Local");
}

export function isProjectedCrs(epsg: number): boolean {
  return epsg >= 6669 && epsg <= 6687;
}

export function isGeographicCrs(epsg: number): boolean {
  return epsg === 6668 || epsg === 4326;
}
