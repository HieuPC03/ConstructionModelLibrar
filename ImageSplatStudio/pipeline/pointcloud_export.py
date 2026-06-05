"""Export point clouds to LAS and TXT formats."""

from __future__ import annotations

from pathlib import Path

import numpy as np


def denormalize_points(
    points: np.ndarray,
    meta: dict,
    *,
    swap_xy: bool = False,
) -> np.ndarray:
    pts = np.asarray(points, dtype=np.float64).copy()
    scale = float(meta.get("scale", 1.0)) or 1.0
    center = np.asarray(meta.get("center", [0, 0, 0]), dtype=np.float64)

    pts = pts / scale
    # Reverse Y-up → Z-up: viewer [x, y, z] → original [x, -z, y]
    pts = np.stack([pts[:, 0], pts[:, 2], -pts[:, 1]], axis=1)

    if swap_xy:
        pts = np.stack([pts[:, 1], pts[:, 0], pts[:, 2]], axis=1)

    pts = pts + center
    return pts


def write_xyz_txt(path: Path, points: np.ndarray, colors: np.ndarray | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = []
    has_color = colors is not None and len(colors) == len(points)
    for i, (x, y, z) in enumerate(points):
        if has_color:
            r, g, b = colors[i]
            ri = int(np.clip(r * 255, 0, 255))
            gi = int(np.clip(g * 255, 0, 255))
            bi = int(np.clip(b * 255, 0, 255))
            lines.append(f"{x:.6f} {y:.6f} {z:.6f} {ri} {gi} {bi}")
        else:
            lines.append(f"{x:.6f} {y:.6f} {z:.6f}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_las_file(path: Path, points: np.ndarray, colors: np.ndarray | None = None) -> None:
    try:
        import laspy
    except ImportError as exc:
        raise ValueError("laspy chưa được cài. Chạy: pip install laspy lazrs") from exc

    path.parent.mkdir(parents=True, exist_ok=True)
    header = laspy.LasHeader(point_format=2, version="1.2")
    header.offsets = np.min(points, axis=0)
    header.scales = np.array([0.001, 0.001, 0.001])

    las = laspy.LasData(header)
    las.x = points[:, 0]
    las.y = points[:, 1]
    las.z = points[:, 2]

    if colors is not None and len(colors) == len(points):
        rgb = (np.clip(colors, 0, 1) * 65535).astype(np.uint16)
        las.red = rgb[:, 0]
        las.green = rgb[:, 1]
        las.blue = rgb[:, 2]

    las.write(str(path))
