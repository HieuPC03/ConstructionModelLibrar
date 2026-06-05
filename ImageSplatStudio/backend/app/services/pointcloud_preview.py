"""Sample point cloud data for frontend preview."""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import numpy as np

from app.config import settings

PREVIEW_FRACTION = 0.2  # 1/5 of points


def _pipeline_path() -> str:
    pipeline_dir = settings.app_root / "pipeline"
    pipeline_str = str(pipeline_dir)
    if pipeline_str not in sys.path:
        sys.path.insert(0, pipeline_str)
    return pipeline_str


def preview_pointcloud_files(paths: list[Path]) -> dict:
    import open3d as o3d

    _pipeline_path()
    from pointcloud_coords import merge_point_cloud_files, sample_fraction

    pcd, _meta = merge_point_cloud_files(paths)
    pts = np.asarray(pcd.points, dtype=np.float64)
    total = len(pts)
    if total == 0:
        raise ValueError("Point cloud rỗng")

    cols = np.asarray(pcd.colors, dtype=np.float64) if pcd.has_colors() else None
    idx = sample_fraction(pts, PREVIEW_FRACTION)
    pts = pts[idx]
    if cols is not None and len(cols) == total:
        cols = cols[idx]

    bbox = pcd.get_axis_aligned_bounding_box()
    ext = bbox.get_extent()
    result: dict = {
        "total_points": int(total),
        "preview_count": int(len(pts)),
        "preview_fraction": PREVIEW_FRACTION,
        "file_count": len(paths),
        "format": paths[0].suffix.lower().lstrip("."),
        "positions": pts.tolist(),
        "bounds": {
            "min": [float(x) for x in np.min(pts, axis=0)],
            "max": [float(x) for x in np.max(pts, axis=0)],
            "size": [float(x) for x in np.max(pts, axis=0) - np.min(pts, axis=0)],
        },
    }
    if cols is not None and len(cols) == len(pts):
        rgb = (np.clip(cols, 0, 1) * 255).astype(np.uint8)
        result["colors"] = rgb.tolist()
    return result


def preview_upload_files(files: list[tuple[bytes, str]]) -> dict:
    tmps: list[Path] = []
    try:
        for content, suffix in files:
            suffix = suffix if suffix.startswith(".") else f".{suffix}"
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(content)
                tmps.append(Path(tmp.name))
        return preview_pointcloud_files(tmps)
    finally:
        for p in tmps:
            p.unlink(missing_ok=True)


def preview_upload(content: bytes, suffix: str) -> dict:
    return preview_upload_files([(content, suffix)])
