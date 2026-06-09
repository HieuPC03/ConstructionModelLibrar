import * as THREE from "three";
import proj4 from "proj4";
import {
  type NormMeta,
  worldToViewer,
  isGeographicCrs,
  isProjectedCrs,
} from "./coordTransform";

export type BasemapMode = "off" | "aerial" | "road" | "hybrid";

const WGS84 = "+proj=longlat +datum=WGS84 +no_defs +type=crs";

const JGD2011_PLANE_DEFS: Record<number, string> = {
  6669: "+proj=tmerc +lat_0=33 +lon_0=129.5 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6670: "+proj=tmerc +lat_0=33 +lon_0=131 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6671: "+proj=tmerc +lat_0=36 +lon_0=132 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6672: "+proj=tmerc +lat_0=33 +lon_0=133 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6673: "+proj=tmerc +lat_0=36 +lon_0=134 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6674: "+proj=tmerc +lat_0=36 +lon_0=136 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6675: "+proj=tmerc +lat_0=36 +lon_0=137 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6676: "+proj=tmerc +lat_0=36 +lon_0=138 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6677: "+proj=tmerc +lat_0=36 +lon_0=139 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6678: "+proj=tmerc +lat_0=36 +lon_0=140 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6679: "+proj=tmerc +lat_0=36 +lon_0=140.5 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6680: "+proj=tmerc +lat_0=40 +lon_0=140.5 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6681: "+proj=tmerc +lat_0=44 +lon_0=142 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6682: "+proj=tmerc +lat_0=44 +lon_0=142.5 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6683: "+proj=tmerc +lat_0=44 +lon_0=143 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6684: "+proj=tmerc +lat_0=44 +lon_0=144 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6685: "+proj=tmerc +lat_0=44 +lon_0=144.5 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6686: "+proj=tmerc +lat_0=44 +lon_0=145 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
  6687: "+proj=tmerc +lat_0=44 +lon_0=145.5 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
};

function sourceCrsDef(epsg: number): string | null {
  if (epsg === 6668) return "+proj=longlat +ellps=GRS80 +no_defs +type=crs";
  if (epsg === 4326) return WGS84;
  if (isProjectedCrs(epsg)) return JGD2011_PLANE_DEFS[epsg] ?? null;
  return null;
}

function toLonLat(x: number, y: number, epsg: number): [number, number] | null {
  const src = sourceCrsDef(epsg);
  if (!src) {
    if (isGeographicCrs(epsg) || (x >= 122 && x <= 154 && y >= 24 && y <= 46)) {
      return [x, y];
    }
    return null;
  }
  try {
    return proj4(src, WGS84, [x, y]) as [number, number];
  } catch {
    return null;
  }
}

export interface BasemapPlacement {
  texture: THREE.Texture;
  width: number;
  height: number;
  center: THREE.Vector3;
}

export function effectiveBasemapMode(enabled: boolean, mode: BasemapMode): BasemapMode {
  if (!enabled) return "off";
  if (mode === "off") return "aerial";
  return mode;
}

function stitchUrl(
  minLon: number,
  minLat: number,
  maxLon: number,
  maxLat: number,
  mode: BasemapMode,
): string {
  const q = new URLSearchParams({
    min_lon: String(minLon),
    min_lat: String(minLat),
    max_lon: String(maxLon),
    max_lat: String(maxLat),
    mode: mode === "hybrid" ? "hybrid" : mode,
  });
  return `/api/basemap/stitch?${q.toString()}`;
}

async function loadStitchedTexture(url: string): Promise<THREE.Texture | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    return await new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        objectUrl,
        (tex) => {
          URL.revokeObjectURL(objectUrl);
          tex.colorSpace = THREE.SRGBColorSpace;
          resolve(tex);
        },
        undefined,
        () => {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        },
      );
    });
  } catch {
    return null;
  }
}

export async function buildGeoreferencedBasemap(
  meta: NormMeta,
  crsEpsg: number,
  mode: BasemapMode,
  swapXy = false,
): Promise<BasemapPlacement | null> {
  if (mode === "off") return null;
  const wmin = meta.world_min;
  const wmax = meta.world_max;
  if (!wmin || !wmax) return null;

  const corners: [number, number][] = [
    [wmin[0], wmin[1]],
    [wmax[0], wmin[1]],
    [wmax[0], wmax[1]],
    [wmin[0], wmax[1]],
  ];

  const lonLats: [number, number][] = [];
  for (const [x, y] of corners) {
    const ll = toLonLat(x, y, crsEpsg);
    if (ll) lonLats.push(ll);
  }
  if (lonLats.length < 4) return null;

  const lons = lonLats.map((p) => p[0]);
  const lats = lonLats.map((p) => p[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const url = stitchUrl(minLon, minLat, maxLon, maxLat, mode);
  const texture = await loadStitchedTexture(url);
  if (!texture) return null;

  const v00 = worldToViewer([wmin[0], wmin[1], wmin[2]], meta, swapXy);
  const v11 = worldToViewer([wmax[0], wmax[1], wmax[2]], meta, swapXy);

  const width = Math.abs(v11[0] - v00[0]) || 1;
  const height = Math.abs(v11[1] - v00[1]) || 1;
  const centerX = (v00[0] + v11[0]) / 2;
  const centerY = (v00[1] + v11[1]) / 2;
  const centerZ = Math.min(v00[2], v11[2]);

  return {
    texture,
    width: width * 1.1,
    height: height * 1.1,
    center: new THREE.Vector3(centerX, centerY, centerZ - width * 0.012),
  };
}
