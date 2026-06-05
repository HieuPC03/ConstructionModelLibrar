export type ColorMode = "rgb" | "elevation" | "intensity" | "uniform" | "classification";

export const COLOR_MODES: ColorMode[] = ["rgb", "elevation", "intensity", "uniform", "classification"];

import { applyClassificationColors } from "./classificationColors";
function elevationRamp(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  if (x < 0.25) return [0, x * 4, 1];
  if (x < 0.5) return [0, 1, 1 - (x - 0.25) * 4];
  if (x < 0.75) return [(x - 0.5) * 4, 1, 0];
  return [1, 1 - (x - 0.75) * 4, 0];
}

function intensityFromRgb(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function applyColorMode(
  count: number,
  positions: Float32Array,
  sourceColors: Uint8Array | null | undefined,
  mode: ColorMode,
  zMin?: number,
  zMax?: number,
  classifications?: Uint8Array | null,
): Float32Array {
  if (mode === "classification") {
    return applyClassificationColors(count, classifications);
  }
  const colors = new Float32Array(count * 3);

  let minZ = zMin;
  let maxZ = zMax;
  if ((mode === "elevation" || mode === "intensity") && (minZ == null || maxZ == null)) {
    minZ = Infinity;
    maxZ = -Infinity;
    for (let i = 0; i < count; i++) {
      const z = positions[i * 3 + 2];
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    if (maxZ <= minZ) maxZ = minZ + 1;
  }

  for (let i = 0; i < count; i++) {
    let r = 0.55;
    let g = 0.65;
    let b = 0.95;

    if (mode === "rgb" && sourceColors) {
      r = sourceColors[i * 3] / 255;
      g = sourceColors[i * 3 + 1] / 255;
      b = sourceColors[i * 3 + 2] / 255;
    } else if (mode === "elevation") {
      const z = positions[i * 3 + 2];
      const t = (z - minZ!) / (maxZ! - minZ!);
      [r, g, b] = elevationRamp(t);
    } else if (mode === "intensity") {
      if (sourceColors) {
        const lum = intensityFromRgb(sourceColors[i * 3], sourceColors[i * 3 + 1], sourceColors[i * 3 + 2]);
        r = g = b = lum;
      } else {
        const z = positions[i * 3 + 2];
        const t = (z - minZ!) / (maxZ! - minZ!);
        r = g = b = t;
      }
    } else if (mode === "uniform") {
      r = 0.72;
      g = 0.78;
      b = 0.88;
    }

    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }

  return colors;
}

export function colorModeLabelKey(mode: ColorMode): string {
  const map: Record<ColorMode, string> = {
    rgb: "colorModeRgb",
    elevation: "colorModeElevation",
    intensity: "colorModeIntensity",
    uniform: "colorModeUniform",
    classification: "colorModeClassification",
  };
  return map[mode];
}
