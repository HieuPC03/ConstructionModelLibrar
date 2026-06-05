/** World ↔ viewer coordinate transforms (matches pipeline/pointcloud_transform.py). */

export interface NormMeta {
  center?: number[];
  scale?: number;
  axis_fix?: string;
  world_min?: number[];
  world_max?: number[];
}

export function viewerToWorld(
  viewer: [number, number, number],
  meta: NormMeta,
  swapXy = false,
): [number, number, number] {
  const scale = meta.scale ?? 1;
  const center = meta.center ?? [0, 0, 0];
  const [vx, vy, vz] = viewer;
  const wx = vx / scale;
  const wy = -vz / scale;
  const wz = vy / scale;
  let ox = wx + center[0];
  let oy = wy + center[1];
  const oz = wz + center[2];
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

export const CRS_PRESETS = [
  { epsg: 6668, name: "JGD2011 (地理座標)" },
  { epsg: 6677, name: "JGD2011 / Plane VII (東京)" },
  { epsg: 4326, name: "WGS84" },
  { epsg: 0, name: "Local / Unknown" },
] as const;
