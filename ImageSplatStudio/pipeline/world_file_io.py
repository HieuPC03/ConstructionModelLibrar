"""World file (.pgw, .jgw, .tfw, .wld) parsing for georeferenced rasters."""

from __future__ import annotations

from pathlib import Path

WORLD_SUFFIXES = (".pgw", ".jgw", ".tfw", ".wld")


def parse_world_file(path: Path) -> tuple[float, float, float, float, float, float]:
    """Return geotransform (A, D, B, E, C, F) — ESRI world file order."""
    lines = [ln.strip() for ln in path.read_text(encoding="utf-8", errors="ignore").splitlines() if ln.strip()]
    if len(lines) < 6:
        raise ValueError(f"World file không hợp lệ (cần 6 dòng): {path.name}")
    vals = tuple(float(lines[i]) for i in range(6))
    return vals  # type: ignore[return-value]


def pixel_to_world(col: float, row: float, tf: tuple[float, float, float, float, float, float]) -> tuple[float, float]:
    a, d, b, e, c, f = tf
    x = a * col + b * row + c
    y = d * col + e * row + f
    return x, y


def image_world_corners(
    width: int,
    height: int,
    tf: tuple[float, float, float, float, float, float],
    z: float = 0.0,
) -> list[list[float]]:
    """Four corners: upper-left, upper-right, lower-right, lower-left (pixel centers at edges)."""
    corners_px = [(0.0, 0.0), (float(width), 0.0), (float(width), float(height)), (0.0, float(height))]
    out: list[list[float]] = []
    for col, row in corners_px:
        x, y = pixel_to_world(col, row, tf)
        out.append([x, y, z])
    return out


def find_world_file(image_path: Path) -> Path | None:
    """Locate sidecar world file for an image (same basename)."""
    stem = image_path.stem
    parent = image_path.parent
    for ext in (".pgw", ".jgw", ".tfw", ".wld", ".PGW", ".JGW", ".TFW", ".WLD"):
        candidate = parent / f"{stem}{ext}"
        if candidate.exists():
            return candidate
    return None


def geotransform_from_tiff(path: Path) -> tuple[float, float, float, float, float, float] | None:
    """Read GeoTIFF geotransform via Pillow if present (optional)."""
    try:
        from PIL import Image

        with Image.open(path) as im:
            if hasattr(im, "tag_v2"):
                tags = im.tag_v2
                # ModelPixelScaleTag=33550, ModelTiepointTag=33922
                if 33922 in tags and 33550 in tags:
                    tie = tags[33922]
                    scale = tags[33550]
                    if len(tie) >= 6 and len(scale) >= 3:
                        # tie: i,j,k, x,y,z at 0,0
                        c, f, _k = tie[3], tie[4], tie[5]
                        a, e = scale[0], -abs(scale[1])
                        return (a, 0.0, 0.0, e, c, f)
    except Exception:
        return None
    return None
