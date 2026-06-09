"""World ↔ viewer coordinate transforms (Z-up GIS, identity in viewer)."""

from __future__ import annotations

import numpy as np


def _legacy_y_up(meta: dict) -> bool:
    return meta.get("axis_fix") == "z_up_to_y_up"


def centered_world_from_viewer(points: np.ndarray, meta: dict) -> np.ndarray:
    """Viewer coords → centered original Z-up world (before adding center)."""
    pts = np.asarray(points, dtype=np.float64)
    scale = float(meta.get("scale", 1.0)) or 1.0
    p = pts / scale
    if _legacy_y_up(meta):
        return np.stack([p[:, 0], -p[:, 2], p[:, 1]], axis=1)
    return p


def viewer_from_centered_world(centered: np.ndarray, meta: dict) -> np.ndarray:
    """Centered Z-up world → viewer coords."""
    wc = np.asarray(centered, dtype=np.float64)
    scale = float(meta.get("scale", 1.0)) or 1.0
    if _legacy_y_up(meta):
        v = np.stack([wc[:, 0], wc[:, 2], -wc[:, 1]], axis=1)
    else:
        v = wc
    return (v * scale).astype(np.float32)


def apply_swap_xy(points: np.ndarray, meta: dict) -> np.ndarray:
    """Swap GIS X↔Y in original space (not viewer axes)."""
    wc = centered_world_from_viewer(points, meta)
    wc[:, [0, 1]] = wc[:, [1, 0]]
    return viewer_from_centered_world(wc, meta)


def denormalize_points(
    points: np.ndarray,
    meta: dict,
    *,
    swap_xy: bool = False,
) -> np.ndarray:
    """Viewer coords → original world XYZ (Z-up, same as import file)."""
    wc = centered_world_from_viewer(points, meta)
    if swap_xy:
        wc[:, [0, 1]] = wc[:, [1, 0]]
    center = np.asarray(meta.get("center", [0, 0, 0]), dtype=np.float64)
    return wc + center


def normalize_single_world(point: list[float], meta: dict, *, swap_xy: bool = False) -> list[float]:
    """One world point → viewer coords (for display)."""
    center = np.asarray(meta.get("center", [0, 0, 0]), dtype=np.float64)
    wc = np.asarray(point, dtype=np.float64) - center
    if swap_xy:
        wc = wc.copy()
        wc[[0, 1]] = wc[[1, 0]]
    v = viewer_from_centered_world(wc.reshape(1, 3), meta)[0]
    return [float(v[0]), float(v[1]), float(v[2])]


def swap_viewer_points(points: list[list[float]] | list[float], meta: dict) -> list:
    """Apply X↔Y world swap to stored viewer-space annotation points."""
    arr = np.asarray(points, dtype=np.float64)
    if arr.ndim == 1:
        return apply_swap_xy(arr.reshape(1, 3), meta)[0].tolist()
    return apply_swap_xy(arr, meta).tolist()
