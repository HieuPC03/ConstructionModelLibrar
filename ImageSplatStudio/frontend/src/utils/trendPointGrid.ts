import * as THREE from "three";
import { viewerToWorld, worldPointToViewerVec, type NormMeta } from "./coordTransform";

function niceStep(span: number, targetLines = 10): number {
  if (span <= 0) return 1;
  const raw = span / targetLines;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let nice = 1;
  if (norm > 5) nice = 10;
  else if (norm > 2) nice = 5;
  else if (norm > 1) nice = 2;
  return nice * mag;
}

function formatCoord(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toFixed(1);
  if (abs >= 100) return value.toFixed(2);
  if (abs >= 1) return value.toFixed(3);
  return value.toFixed(4);
}

function makeLabelSprite(text: string, color = "#111111"): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const fontSize = 22;
  ctx.font = `600 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
  const metrics = ctx.measureText(text);
  canvas.width = Math.ceil(metrics.width) + 12;
  canvas.height = fontSize + 10;
  ctx.font = `600 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 6, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  const scale = canvas.width / 120;
  sprite.scale.set(scale, (canvas.height / 120) * 0.55, 1);
  return sprite;
}

export interface TrendPointGridOptions {
  min: THREE.Vector3;
  max: THREE.Vector3;
  normMeta?: NormMeta;
  swapXy?: boolean;
  groundZ?: number;
}

/** TREND-POINT style coordinate grid with labeled axes (Z-up). */
export function createTrendPointGrid(options: TrendPointGridOptions): THREE.Group {
  const { min, max, normMeta, swapXy = false } = options;
  const group = new THREE.Group();
  group.name = "trend-point-grid";

  const groundZ = options.groundZ ?? min.z;
  const spanX = Math.max(max.x - min.x, 0.01);
  const spanY = Math.max(max.y - min.y, 0.01);
  const spanZ = Math.max(max.z - min.z, 0.01);
  const pad = Math.max(spanX, spanY) * 0.08;
  const x0 = min.x - pad;
  const x1 = max.x + pad;
  const y0 = min.y - pad;
  const y1 = max.y + pad;

  const stepX = niceStep(spanX + pad * 2);
  const stepY = niceStep(spanY + pad * 2);
  const stepZ = niceStep(spanZ);

  const linePositions: number[] = [];
  const majorColor = 0x888888;

  for (let x = Math.floor(x0 / stepX) * stepX; x <= x1 + stepX * 0.01; x += stepX) {
    linePositions.push(x, y0, groundZ, x, y1, groundZ);
  }
  for (let y = Math.floor(y0 / stepY) * stepY; y <= y1 + stepY * 0.01; y += stepY) {
    linePositions.push(x0, y, groundZ, x1, y, groundZ);
  }

  const gridGeom = new THREE.BufferGeometry();
  gridGeom.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
  const gridLines = new THREE.LineSegments(
    gridGeom,
    new THREE.LineBasicMaterial({ color: majorColor, transparent: true, opacity: 0.85 }),
  );
  group.add(gridLines);

  // Axis lines (X red, Y green, Z blue) — TREND-POINT style
  const axisLen = Math.max(spanX, spanY, spanZ) * 0.35;
  const cx = (min.x + max.x) / 2;
  const cy = (min.y + max.y) / 2;
  const axisGroup = new THREE.Group();
  const axes = [
    { from: [cx, cy, groundZ], to: [cx + axisLen, cy, groundZ], color: 0xcc3333 },
    { from: [cx, cy, groundZ], to: [cx, cy + axisLen, groundZ], color: 0x33aa33 },
    { from: [cx, cy, groundZ], to: [cx, cy, groundZ + axisLen], color: 0x3366cc },
  ];
  for (const ax of axes) {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(ax.from[0], ax.from[1], ax.from[2]),
      new THREE.Vector3(ax.to[0], ax.to[1], ax.to[2]),
    ]);
    axisGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: ax.color, linewidth: 2 })));
  }
  group.add(axisGroup);

  const worldAt = (vx: number, vy: number, vz: number): [number, number, number] => {
    if (!normMeta) return [vx, vy, vz];
    return viewerToWorld([vx, vy, vz], normMeta, swapXy);
  };

  // X labels along bottom edge
  for (let x = Math.floor(x0 / stepX) * stepX; x <= x1; x += stepX) {
    const w = worldAt(x, y0, groundZ);
    const sprite = makeLabelSprite(formatCoord(w[0]));
    sprite.position.set(x, y0 - pad * 0.35, groundZ);
    group.add(sprite);
  }

  // Y labels along right edge
  for (let y = Math.floor(y0 / stepY) * stepY; y <= y1; y += stepY) {
    const w = worldAt(x1, y, groundZ);
    const sprite = makeLabelSprite(formatCoord(w[1]));
    sprite.position.set(x1 + pad * 0.35, y, groundZ);
    group.add(sprite);
  }

  // Z elevation labels on left
  const zBase = groundZ;
  for (let z = zBase; z <= max.z + stepZ * 0.01; z += stepZ) {
    const w = worldAt(x0, cy, z);
    const sprite = makeLabelSprite(formatCoord(w[2]), "#3366cc");
    sprite.position.set(x0 - pad * 0.35, cy, z);
    group.add(sprite);
  }

  return group;
}

export function groundPlaneZ(min: THREE.Vector3, normMeta?: NormMeta, swapXy?: boolean): number {
  if (normMeta?.world_min && normMeta.world_min.length >= 3) {
    const g = worldPointToViewerVec(
      [normMeta.world_min[0], normMeta.world_min[1], normMeta.world_min[2]],
      normMeta,
      !!swapXy,
    );
    return g.z;
  }
  return min.z;
}
