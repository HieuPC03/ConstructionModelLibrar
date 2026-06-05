"""World ↔ viewer coordinate transforms (Z-up GIS → Y-up Three.js)."""

from __future__ import annotations

import numpy as np


def centered_world_from_viewer(points: np.ndarray, meta: dict) -> np.ndarray:
    """Viewer coords → centered original Z-up world (before adding center)."""
    pts = np.asarray(points, dtype=np.float64)
    scale = float(meta.get("scale", 1.0)) or 1.0
    p = pts / scale
    # Inverse axis fix: viewer [x,y,z] → centered world [x, -z, y]
    return np.stack([p[:, 0], -p[:, 2], p[:, 1]], axis=1)


def viewer_from_centered_world(centered: np.ndarray, meta: dict) -> np.ndarray:
    """Centered Z-up world → viewer coords."""
    wc = np.asarray(centered, dtype=np.float64)
    scale = float(meta.get("scale", 1.0)) or 1.0
    v = np.stack([wc[:, 0], wc[:, 2], -wc[:, 1]], axis=1)
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
