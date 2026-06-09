"""Sample point cloud data for frontend preview."""

from __future__ import annotations

import struct
import sys
import tempfile
from pathlib import Path

import numpy as np

from app.config import settings
from app.services.pointcloud_editor import init_session_state
from app.services.preview_cache import create_session, get_session

DEFAULT_PREVIEW_PERCENT = 20
MIN_PREVIEW_PERCENT = 1
MAX_PREVIEW_PERCENT = 100
GEOMETRY_MAGIC = b"ISPC"


def _pipeline_path() -> str:
    pipeline_dir = settings.app_root / "pipeline"
    pipeline_str = str(pipeline_dir)
    if pipeline_str not in sys.path:
        sys.path.insert(0, pipeline_str)
    return pipeline_str


def _clamp_percent(percent: float) -> float:
    return max(MIN_PREVIEW_PERCENT, min(MAX_PREVIEW_PERCENT, percent))


def _prepare_session_points(session_id: str) -> tuple[np.ndarray, np.ndarray | None, np.ndarray | None]:
    _pipeline_path()
    from pointcloud_editor_ops import apply_swap_xy, compute_visibility_mask

    from app.services.pointcloud_editor import load_classifications, load_hidden_mask, load_state

    session = get_session(session_id)
    if session is None:
        raise ValueError("Phiên preview đã hết hạn — tải lại file.")

    pts = np.asarray(np.load(session.points_path), dtype=np.float32)
    cols = np.load(session.colors_path) if session.colors_path else None
    cls = load_classifications(session_id)
    state = load_state(session_id)
    meta = state.get("norm_meta", {})
    if state.get("swap_xy"):
        pts = apply_swap_xy(pts, meta)
    hidden_mask = load_hidden_mask(session_id, len(pts))
    mask = compute_visibility_mask(len(pts), state, pts, hidden_mask)
    hidden_cls = state.get("hidden_class_ids", [])
    if hidden_cls and cls is not None and len(cls) == len(mask):
        cls_mask = ~np.isin(cls, hidden_cls)
        mask = mask & cls_mask
    pts = pts[mask]
    if cols is not None and len(cols) == len(mask):
        cols = cols[mask]
    if cls is not None and len(cls) == len(mask):
        cls = cls[mask]
    return pts, cols, cls


def _sample_points(
    pts: np.ndarray,
    cols: np.ndarray | None,
    cls: np.ndarray | None,
    percent: float,
) -> tuple[np.ndarray, np.ndarray | None, np.ndarray | None, float]:
    _pipeline_path()
    from pointcloud_coords import sample_fraction

    fraction = _clamp_percent(percent) / 100.0
    total = len(pts)
    if total == 0:
        raise ValueError("Point cloud rỗng")

    idx = sample_fraction(pts, fraction)
    sampled_pts = np.asarray(pts[idx], dtype=np.float32)
    sampled_cols = (
        np.asarray(cols[idx], dtype=np.float32) if cols is not None and len(cols) == total else None
    )
    sampled_cls = np.asarray(cls[idx], dtype=np.uint8) if cls is not None and len(cls) == total else None
    actual_fraction = len(sampled_pts) / total
    return sampled_pts, sampled_cols, sampled_cls, actual_fraction


def _bounds_from_points(pts: np.ndarray) -> dict:
    return {
        "min": [float(x) for x in np.min(pts, axis=0)],
        "max": [float(x) for x in np.max(pts, axis=0)],
        "size": [float(x) for x in np.max(pts, axis=0) - np.min(pts, axis=0)],
    }


def _build_metadata(
    *,
    total: int,
    preview_count: int,
    percent: float,
    actual_fraction: float,
    file_count: int,
    format_name: str,
    bounds: dict,
    session_id: str,
    has_colors: bool,
) -> dict:
    return {
        "total_points": int(total),
        "preview_count": int(preview_count),
        "preview_percent": round(_clamp_percent(percent), 1),
        "preview_fraction": float(actual_fraction),
        "preview_session_id": session_id,
        "file_count": file_count,
        "format": format_name,
        "has_colors": has_colors,
        "bounds": bounds,
    }


def pack_preview_geometry(pts: np.ndarray, cols: np.ndarray | None, cls: np.ndarray | None = None) -> bytes:
    count = len(pts)
    has_colors = cols is not None and len(cols) == count
    has_cls = cls is not None and len(cls) == count
    header = struct.pack("<4sIBB2x", GEOMETRY_MAGIC, count, 1 if has_colors else 0, 1 if has_cls else 0)
    positions = np.asarray(pts, dtype=np.float32).tobytes()
    chunks = [header, positions]
    if has_colors:
        rgb = (np.clip(cols, 0, 1) * 255).astype(np.uint8)
        chunks.append(rgb.tobytes())
    if has_cls:
        chunks.append(np.asarray(cls, dtype=np.uint8).tobytes())
    return b"".join(chunks)


def sample_session_geometry(session_id: str, percent: float) -> tuple[np.ndarray, np.ndarray | None, np.ndarray | None, dict]:
    session = get_session(session_id)
    if session is None:
        raise ValueError("Phiên preview đã hết hạn — tải lại file.")

    pts, cols, cls = _prepare_session_points(session_id)
    visible_total = len(pts)
    sampled_pts, sampled_cols, sampled_cls, actual_fraction = _sample_points(pts, cols, cls, percent)
    metadata = _build_metadata(
        total=visible_total,
        preview_count=len(sampled_pts),
        percent=percent,
        actual_fraction=actual_fraction,
        file_count=session.file_count,
        format_name=session.format,
        bounds=_bounds_from_points(sampled_pts),
        session_id=session.session_id,
        has_colors=sampled_cols is not None,
    )
    metadata["has_classifications"] = sampled_cls is not None
    return sampled_pts, sampled_cols, sampled_cls, metadata


def preview_pointcloud_files(paths: list[Path], percent: float = DEFAULT_PREVIEW_PERCENT) -> dict:
    _pipeline_path()
    from pointcloud_coords import merge_point_cloud_files_with_info

    pcd, norm_meta, files_info, combined_cls = merge_point_cloud_files_with_info(paths)
    pts = np.asarray(pcd.points, dtype=np.float32)
    total = len(pts)
    if total == 0:
        raise ValueError("Point cloud rỗng")

    cols = np.asarray(pcd.colors, dtype=np.float32) if pcd.has_colors() else None
    session = create_session(
        pts,
        cols,
        classifications=combined_cls,
        file_count=len(paths),
        format_name=paths[0].suffix.lower().lstrip("."),
    )
    init_session_state(session.session_id, files_info, norm_meta)
    sampled_pts, sampled_cols, sampled_cls, actual_fraction = _sample_points(pts, cols, combined_cls, percent)
    return _build_metadata(
        total=total,
        preview_count=len(sampled_pts),
        percent=percent,
        actual_fraction=actual_fraction,
        file_count=len(paths),
        format_name=paths[0].suffix.lower().lstrip("."),
        bounds=_bounds_from_points(sampled_pts),
        session_id=session.session_id,
        has_colors=sampled_cols is not None,
    )


def preview_from_session(session_id: str, percent: float = DEFAULT_PREVIEW_PERCENT) -> dict:
    _, _, _, metadata = sample_session_geometry(session_id, percent)
    return metadata


def preview_upload_files(
    files: list[tuple[bytes, str, str]],
    percent: float = DEFAULT_PREVIEW_PERCENT,
) -> dict:
    tmps: list[Path] = []
    tmp_dir = Path(tempfile.mkdtemp(prefix="pc_upload_"))
    try:
        for content, suffix, name in files:
            suffix = suffix if suffix.startswith(".") else f".{suffix}"
            safe_name = Path(name).name if name else f"upload{suffix}"
            if not safe_name.lower().endswith(suffix.lower()):
                safe_name = f"{Path(safe_name).stem}{suffix}"
            dest = tmp_dir / safe_name
            dest.write_bytes(content)
            tmps.append(dest)
        return preview_pointcloud_files(tmps, percent=percent)
    finally:
        import shutil

        shutil.rmtree(tmp_dir, ignore_errors=True)


def preview_upload(content: bytes, suffix: str, percent: float = DEFAULT_PREVIEW_PERCENT) -> dict:
    return preview_upload_files([(content, suffix, f"upload{suffix}")], percent=percent)
