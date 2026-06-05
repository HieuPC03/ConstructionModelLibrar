"""Sample point cloud data for frontend preview."""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import numpy as np

from app.config import settings
from app.services.preview_cache import create_session, get_session

DEFAULT_PREVIEW_PERCENT = 20
MIN_PREVIEW_PERCENT = 1
MAX_PREVIEW_PERCENT = 100
MAX_PREVIEW_POINTS = 500_000


def _pipeline_path() -> str:
    pipeline_dir = settings.app_root / "pipeline"
    pipeline_str = str(pipeline_dir)
    if pipeline_str not in sys.path:
        sys.path.insert(0, pipeline_str)
    return pipeline_str


def _clamp_percent(percent: float) -> float:
    return max(MIN_PREVIEW_PERCENT, min(MAX_PREVIEW_PERCENT, percent))


def _sample_points(
    pts: np.ndarray,
    cols: np.ndarray | None,
    percent: float,
) -> tuple[np.ndarray, np.ndarray | None, float]:
    _pipeline_path()
    from pointcloud_coords import sample_fraction

    fraction = _clamp_percent(percent) / 100.0
    total = len(pts)
    if total == 0:
        raise ValueError("Point cloud rỗng")

    idx = sample_fraction(pts, fraction)
    if len(idx) > MAX_PREVIEW_POINTS:
        rng = np.random.default_rng(42)
        idx = rng.choice(idx, MAX_PREVIEW_POINTS, replace=False)

    sampled_pts = np.asarray(pts[idx], dtype=np.float64)
    sampled_cols = np.asarray(cols[idx], dtype=np.float64) if cols is not None and len(cols) == total else None
    actual_fraction = len(sampled_pts) / total
    return sampled_pts, sampled_cols, actual_fraction


def _build_response(
    *,
    total: int,
    pts: np.ndarray,
    cols: np.ndarray | None,
    percent: float,
    actual_fraction: float,
    file_count: int,
    format_name: str,
    session_id: str | None = None,
) -> dict:
    result: dict = {
        "total_points": int(total),
        "preview_count": int(len(pts)),
        "preview_percent": round(_clamp_percent(percent), 1),
        "preview_fraction": float(actual_fraction),
        "preview_capped": len(pts) >= MAX_PREVIEW_POINTS,
        "max_preview_points": MAX_PREVIEW_POINTS,
        "file_count": file_count,
        "format": format_name,
        "positions": pts.tolist(),
        "bounds": {
            "min": [float(x) for x in np.min(pts, axis=0)],
            "max": [float(x) for x in np.max(pts, axis=0)],
            "size": [float(x) for x in np.max(pts, axis=0) - np.min(pts, axis=0)],
        },
    }
    if session_id:
        result["preview_session_id"] = session_id
    if cols is not None and len(cols) == len(pts):
        rgb = (np.clip(cols, 0, 1) * 255).astype(np.uint8)
        result["colors"] = rgb.tolist()
    return result


def preview_pointcloud_files(paths: list[Path], percent: float = DEFAULT_PREVIEW_PERCENT) -> dict:
    _pipeline_path()
    from pointcloud_coords import merge_point_cloud_files

    pcd, _meta = merge_point_cloud_files(paths)
    pts = np.asarray(pcd.points, dtype=np.float32)
    total = len(pts)
    if total == 0:
        raise ValueError("Point cloud rỗng")

    cols = np.asarray(pcd.colors, dtype=np.float32) if pcd.has_colors() else None
    session = create_session(
        pts,
        cols,
        file_count=len(paths),
        format_name=paths[0].suffix.lower().lstrip("."),
    )
    sampled_pts, sampled_cols, actual_fraction = _sample_points(pts, cols, percent)
    return _build_response(
        total=total,
        pts=sampled_pts,
        cols=sampled_cols,
        percent=percent,
        actual_fraction=actual_fraction,
        file_count=len(paths),
        format_name=paths[0].suffix.lower().lstrip("."),
        session_id=session.session_id,
    )


def preview_from_session(session_id: str, percent: float = DEFAULT_PREVIEW_PERCENT) -> dict:
    session = get_session(session_id)
    if session is None:
        raise ValueError("Phiên preview đã hết hạn — tải lại file.")

    pts = np.load(session.points_path, mmap_mode="r")
    cols = np.load(session.colors_path, mmap_mode="r") if session.colors_path else None
    sampled_pts, sampled_cols, actual_fraction = _sample_points(pts, cols, percent)
    return _build_response(
        total=session.total_points,
        pts=sampled_pts,
        cols=sampled_cols,
        percent=percent,
        actual_fraction=actual_fraction,
        file_count=session.file_count,
        format_name=session.format,
        session_id=session.session_id,
    )


def preview_upload_files(
    files: list[tuple[bytes, str]],
    percent: float = DEFAULT_PREVIEW_PERCENT,
) -> dict:
    tmps: list[Path] = []
    try:
        for content, suffix in files:
            suffix = suffix if suffix.startswith(".") else f".{suffix}"
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(content)
                tmps.append(Path(tmp.name))
        return preview_pointcloud_files(tmps, percent=percent)
    finally:
        for p in tmps:
            p.unlink(missing_ok=True)


def preview_upload(content: bytes, suffix: str, percent: float = DEFAULT_PREVIEW_PERCENT) -> dict:
    return preview_upload_files([(content, suffix)], percent=percent)
