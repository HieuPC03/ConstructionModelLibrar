"""Sample point cloud data for frontend preview."""

from __future__ import annotations

import tempfile
from pathlib import Path

import numpy as np

from app.config import settings

MAX_PREVIEW_POINTS = 30_000


def preview_pointcloud_file(path: Path) -> dict:
    import open3d as o3d
    import sys

    pipeline_dir = settings.app_root / "pipeline"
    pipeline_str = str(pipeline_dir)
    if pipeline_str not in sys.path:
        sys.path.insert(0, pipeline_str)

    from pointcloud_io import load_point_cloud_file

    loaded = load_point_cloud_file(path)

    if isinstance(loaded, tuple) and loaded[0] == "3dgs_ply":
        from plyfile import PlyData

        ply = PlyData.read(str(loaded[1]))
        vertex = ply["vertex"]
        names = vertex.data.dtype.names or ()
        xs = np.asarray(vertex["x"], dtype=np.float64)
        ys = np.asarray(vertex["y"], dtype=np.float64)
        zs = np.asarray(vertex["z"], dtype=np.float64)
        pts = np.stack([xs, ys, zs], axis=1)
        total = len(pts)
        cols = None
        if "red" in names:
            cols = np.stack(
                [
                    np.asarray(vertex["red"], dtype=np.float64) / 255.0,
                    np.asarray(vertex["green"], dtype=np.float64) / 255.0,
                    np.asarray(vertex["blue"], dtype=np.float64) / 255.0,
                ],
                axis=1,
            )
        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(pts)
        if cols is not None:
            pcd.colors = o3d.utility.Vector3dVector(cols)
    else:
        pcd = loaded
        pts = np.asarray(pcd.points, dtype=np.float64)
        total = len(pts)
        cols = np.asarray(pcd.colors, dtype=np.float64) if pcd.has_colors() else None

    if total == 0:
        raise ValueError("Point cloud rỗng")

    if total > MAX_PREVIEW_POINTS:
        rng = np.random.default_rng(42)
        idx = rng.choice(total, MAX_PREVIEW_POINTS, replace=False)
        pts = pts[idx]
        if cols is not None and len(cols) == total:
            cols = cols[idx]

    bbox = pcd.get_axis_aligned_bounding_box()
    ext = bbox.get_extent()
    result: dict = {
        "total_points": int(total),
        "preview_count": int(len(pts)),
        "format": path.suffix.lower().lstrip("."),
        "positions": pts.tolist(),
        "bounds": {
            "min": [float(x) for x in bbox.min_bound],
            "max": [float(x) for x in bbox.max_bound],
            "size": [float(x) for x in ext],
        },
    }
    if cols is not None and len(cols) == len(pts):
        rgb = (np.clip(cols, 0, 1) * 255).astype(np.uint8)
        result["colors"] = rgb.tolist()
    return result


def preview_upload(content: bytes, suffix: str) -> dict:
    suffix = suffix if suffix.startswith(".") else f".{suffix}"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)
    try:
        return preview_pointcloud_file(tmp_path)
    finally:
        tmp_path.unlink(missing_ok=True)
