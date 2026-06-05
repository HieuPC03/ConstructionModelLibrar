"""Point cloud region filters — TREND-POINT style trim & filter."""

from __future__ import annotations

import numpy as np


def delete_points_in_box(
    points: np.ndarray,
    colors: np.ndarray | None,
    min_pt: list[float],
    max_pt: list[float],
    *,
    mode: str = "inside",
) -> tuple[np.ndarray, np.ndarray | None, int]:
    """Remove points inside or outside an axis-aligned box."""
    pts = np.asarray(points, dtype=np.float32)
    mn = np.asarray(min_pt, dtype=np.float32)
    mx = np.asarray(max_pt, dtype=np.float32)
    lo = np.minimum(mn, mx)
    hi = np.maximum(mn, mx)
    inside = np.all((pts >= lo) & (pts <= hi), axis=1)
    if mode == "outside":
        keep = inside
    else:
        keep = ~inside
    removed = int(np.sum(~keep))
    new_pts = pts[keep]
    new_cols = colors[keep] if colors is not None and len(colors) == len(pts) else None
    return new_pts, new_cols, removed


def delete_points_in_polygon_xy(
    points: np.ndarray,
    colors: np.ndarray | None,
    polygon: list[list[float]],
) -> tuple[np.ndarray, np.ndarray | None, int]:
    """Remove points whose XY projection lies inside a closed polygon."""
    pts = np.asarray(points, dtype=np.float32)
    poly = np.asarray(polygon, dtype=np.float64)
    if len(poly) < 3:
        raise ValueError("Đa giác cần ít nhất 3 đỉnh.")
    xy = pts[:, :2]
    inside = _points_in_polygon(xy, poly[:, :2])
    keep = ~inside
    removed = int(np.sum(inside))
    new_pts = pts[keep]
    new_cols = colors[keep] if colors is not None and len(colors) == len(pts) else None
    return new_pts, new_cols, removed


def _points_in_polygon(points: np.ndarray, polygon: np.ndarray) -> np.ndarray:
    """Vectorized ray-casting point-in-polygon (even-odd rule)."""
    n = len(polygon)
    x = points[:, 0]
    y = points[:, 1]
    inside = np.zeros(len(points), dtype=bool)
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        cond = ((yi > y) != (yj > y)) & (x < (xj - xi) * (y - yi) / (yj - yi + 1e-15) + xi)
        inside ^= cond
        j = i
    return inside


def filter_by_density(
    points: np.ndarray,
    colors: np.ndarray | None,
    *,
    radius: float,
    min_neighbors: int = 5,
) -> tuple[np.ndarray, np.ndarray | None, int]:
    """Remove points in sparse regions (density filter)."""
    import open3d as o3d

    pts = np.asarray(points, dtype=np.float64)
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(pts)
    if colors is not None and len(colors) == len(points):
        pcd.colors = o3d.utility.Vector3dVector(np.asarray(colors, dtype=np.float64))
    tree = o3d.geometry.KDTreeFlann(pcd)
    keep = np.ones(len(pts), dtype=bool)
    r = float(radius)
    for i in range(len(pts)):
        _, idx, _ = tree.search_radius_vector_3d(pcd.points[i], r)
        if len(idx) < min_neighbors:
            keep[i] = False
    removed = int(np.sum(~keep))
    new_pts = np.asarray(points, dtype=np.float32)[keep]
    new_cols = colors[keep] if colors is not None and len(colors) == len(points) else None
    return new_pts, new_cols, removed


def filter_ground_offset(
    points: np.ndarray,
    colors: np.ndarray | None,
    *,
    cell_size: float,
    max_offset: float,
) -> tuple[np.ndarray, np.ndarray | None, int]:
    """Remove points far above local ground surface (tree/noise filter)."""
    pts = np.asarray(points, dtype=np.float32)
    cell = max(float(cell_size), 1e-4)
    xy = pts[:, :2]
    mn = np.min(xy, axis=0)
    ix = np.floor((xy[:, 0] - mn[0]) / cell).astype(np.int64)
    iy = np.floor((xy[:, 1] - mn[1]) / cell).astype(np.int64)
    ground: dict[tuple[int, int], float] = {}
    for i in range(len(pts)):
        key = (int(ix[i]), int(iy[i]))
        z = float(pts[i, 2])
        if key not in ground or z < ground[key]:
            ground[key] = z
    keep = np.ones(len(pts), dtype=bool)
    max_off = float(max_offset)
    for i in range(len(pts)):
        key = (int(ix[i]), int(iy[i]))
        gz = ground.get(key, float(pts[i, 2]))
        if float(pts[i, 2]) - gz > max_off:
            keep[i] = False
    removed = int(np.sum(~keep))
    new_pts = pts[keep]
    new_cols = colors[keep] if colors is not None and len(colors) == len(pts) else None
    return new_pts, new_cols, removed
