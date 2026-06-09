"""Export point clouds to LAS and TXT formats."""

from __future__ import annotations

from pathlib import Path

import numpy as np

from pointcloud_transform import denormalize_points

__all__ = ["denormalize_points", "write_xyz_txt", "write_las_file", "write_ply_file"]


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


def write_ply_file(path: Path, points: np.ndarray, colors: np.ndarray | None = None) -> None:
    """Write ASCII PLY point cloud (TREND-POINT compatible)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    pts = np.asarray(points, dtype=np.float64)
    has_color = colors is not None and len(colors) == len(pts)
    lines = [
        "ply",
        "format ascii 1.0",
        f"element vertex {len(pts)}",
        "property float x",
        "property float y",
        "property float z",
    ]
    if has_color:
        lines.extend(
            [
                "property uchar red",
                "property uchar green",
                "property uchar blue",
            ]
        )
    lines.append("end_header")
    for i, (x, y, z) in enumerate(pts):
        if has_color:
            r, g, b = colors[i]
            ri = int(np.clip(r * 255, 0, 255))
            gi = int(np.clip(g * 255, 0, 255))
            bi = int(np.clip(b * 255, 0, 255))
            lines.append(f"{x:.6f} {y:.6f} {z:.6f} {ri} {gi} {bi}")
        else:
            lines.append(f"{x:.6f} {y:.6f} {z:.6f}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
