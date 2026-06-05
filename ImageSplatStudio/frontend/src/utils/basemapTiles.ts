import * as THREE from "three";
import proj4 from "proj4";
import {
  type NormMeta,
  worldToViewer,
  isGeographicCrs,
  isProjectedCrs,
} from "./coordTransform";

export type BasemapMode = "off" | "aerial" | "road" | "hybrid";

const GSI_TILE_URL: Record<Exclude<BasemapMode, "off">, string> = {
  aerial: "https://cyberjapandrs.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  road: "https://cyberjapandrs.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
  hybrid: "https://cyberjapandrs.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
};

const JGD2011_GEO = "+proj=longlat +ellps=GRS80 +no_defs +type=crs";
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
  if (epsg === 6668) return JGD2011_GEO;
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
    const [lon, lat] = proj4(src, WGS84, [x, y]);
    return [lon, lat];
  } catch {
    return null;
  }
}

function lonLatToTile(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

function pickZoom(lonSpan: number, latSpan: number): number {
  const span = Math.max(lonSpan, latSpan, 1e-6);
  if (span > 2) return 10;
  if (span > 0.5) return 12;
  if (span > 0.1) return 14;
  if (span > 0.02) return 15;
  if (span > 0.005) return 16;
  return 17;
}

async function loadTile(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export interface BasemapPlacement {
  texture: THREE.Texture;
  width: number;
  height: number;
  center: THREE.Vector3;
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

  const zoom = pickZoom(maxLon - minLon, maxLat - minLat);
  const tMin = lonLatToTile(minLon, maxLat, zoom);
  const tMax = lonLatToTile(maxLon, minLat, zoom);

  const tileW = tMax.x - tMin.x + 1;
  const tileH = tMax.y - tMin.y + 1;
  if (tileW <= 0 || tileH <= 0 || tileW > 8 || tileH > 8) return null;

  const canvas = document.createElement("canvas");
  const tileSize = 256;
  canvas.width = tileW * tileSize;
  canvas.height = tileH * tileSize;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1a2230";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const baseUrl = GSI_TILE_URL[mode];
  for (let ty = tMin.y; ty <= tMax.y; ty++) {
    for (let tx = tMin.x; tx <= tMax.x; tx++) {
      const url = baseUrl.replace("{z}", String(zoom)).replace("{x}", String(tx)).replace("{y}", String(ty));
      const img = await loadTile(url);
      const dx = (tx - tMin.x) * tileSize;
      const dy = (ty - tMin.y) * tileSize;
      if (img) {
        ctx.drawImage(img, dx, dy, tileSize, tileSize);
        if (mode === "hybrid") {
          const roadUrl = GSI_TILE_URL.road
            .replace("{z}", String(zoom))
            .replace("{x}", String(tx))
            .replace("{y}", String(ty));
          const road = await loadTile(roadUrl);
          if (road) ctx.drawImage(road, dx, dy, tileSize, tileSize);
        }
      }
    }
  }

  const v00 = worldToViewer([wmin[0], wmin[1], wmin[2]], meta, swapXy);
  const v11 = worldToViewer([wmax[0], wmax[1], wmax[2]], meta, swapXy);

  const width = Math.abs(v11[0] - v00[0]) || 1;
  const height = Math.abs(v11[1] - v00[1]) || 1;
  const centerX = (v00[0] + v11[0]) / 2;
  const centerY = (v00[1] + v11[1]) / 2;
  const centerZ = Math.min(v00[2], v11[2]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  return {
    texture: tex,
    width: width * 1.05,
    height: height * 1.05,
    center: new THREE.Vector3(centerX, centerY, centerZ - width * 0.005),
  };
}
