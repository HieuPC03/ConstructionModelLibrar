"""Screen-space lasso selection and point classification helpers."""

from __future__ import annotations

import numpy as np

from pointcloud_filters import _points_in_polygon


def project_points_to_ndc(
    points: np.ndarray,
    view_matrix: list[float],
    proj_matrix: list[float],
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Project 3D points to normalized device coordinates (Three.js column-major matrices)."""
    pts = np.asarray(points, dtype=np.float64)
    v = np.array(view_matrix, dtype=np.float64).reshape(4, 4, order="F")
    p = np.array(proj_matrix, dtype=np.float64).reshape(4, 4, order="F")
    m = p @ v
    ones = np.ones((len(pts), 1), dtype=np.float64)
    homo = np.hstack([pts, ones])
    clip = homo @ m.T
    w = clip[:, 3]
    valid = w > 1e-8
    ndc = np.zeros((len(pts), 2), dtype=np.float64)
    ndc[valid, 0] = clip[valid, 0] / w[valid]
    ndc[valid, 1] = clip[valid, 1] / w[valid]
    return ndc[:, 0], ndc[:, 1], valid


def mask_points_in_screen_polygon(
    points: np.ndarray,
    polygon_ndc: list[list[float]],
    view_matrix: list[float],
    proj_matrix: list[float],
) -> np.ndarray:
    """Return boolean mask of points whose screen projection lies inside a closed NDC polygon."""
    if len(polygon_ndc) < 3:
        raise ValueError("Lasso cần ít nhất 3 điểm.")
    poly = np.asarray(polygon_ndc, dtype=np.float64)[:, :2]
    ndc_x, ndc_y, valid = project_points_to_ndc(points, view_matrix, proj_matrix)
    xy = np.stack([ndc_x, ndc_y], axis=1)
    inside = _points_in_polygon(xy, poly) & valid
    return inside


def apply_mask_delete(
    points: np.ndarray,
    colors: np.ndarray | None,
    classes: np.ndarray | None,
    mask: np.ndarray,
) -> tuple[np.ndarray, np.ndarray | None, np.ndarray | None, int]:
    keep = ~mask
    removed = int(np.sum(mask))
    new_pts = points[keep]
    new_cols = colors[keep] if colors is not None and len(colors) == len(points) else None
    new_cls = classes[keep] if classes is not None and len(classes) == len(points) else None
    return new_pts, new_cols, new_cls, removed


def apply_mask_classify(
    classes: np.ndarray,
    mask: np.ndarray,
    class_id: int,
) -> np.ndarray:
    out = np.asarray(classes, dtype=np.uint8).copy()
    cid = int(class_id) & 0xFF
    out[mask] = cid
    return out


def bbox_from_mask(points: np.ndarray, mask: np.ndarray) -> tuple[list[float], list[float]] | None:
    sel = points[mask]
    if len(sel) == 0:
        return None
    mn = np.min(sel, axis=0)
    mx = np.max(sel, axis=0)
    pad = np.maximum((mx - mn) * 0.02, 0.01)
    return (mn - pad).tolist(), (mx + pad).tolist()


def classification_counts(classes: np.ndarray) -> dict[str, int]:
    if classes is None or len(classes) == 0:
        return {}
    unique, counts = np.unique(classes, return_counts=True)
    return {str(int(u)): int(c) for u, c in zip(unique, counts)}
