"""TREND-POINT style survey operations: cross-section, contours, volume, density."""

from __future__ import annotations

import math

import numpy as np


def angle_at_vertex(
    p1: list[float] | np.ndarray,
    p2: list[float] | np.ndarray,
    p3: list[float] | np.ndarray,
) -> float:
    """Interior angle at p2 (degrees, 0–180)."""
    a = np.asarray(p1, dtype=np.float64) - np.asarray(p2, dtype=np.float64)
    b = np.asarray(p3, dtype=np.float64) - np.asarray(p2, dtype=np.float64)
    la = float(np.linalg.norm(a))
    lb = float(np.linalg.norm(b))
    if la < 1e-12 or lb < 1e-12:
        return 0.0
    cos_v = float(np.clip(np.dot(a, b) / (la * lb), -1.0, 1.0))
    return math.degrees(math.acos(cos_v))


def extract_cross_section(
    points: np.ndarray,
    start: list[float],
    end: list[float],
    *,
    width: float = 0.5,
    n_samples: int = 200,
) -> dict:
    """Elevation profile along a line (TREND-POINT 断面)."""
    pts = np.asarray(points, dtype=np.float64)
    if len(pts) == 0:
        raise ValueError("Không có điểm để trích xuất mặt cắt")

    a = np.asarray(start[:3], dtype=np.float64)
    b = np.asarray(end[:3], dtype=np.float64)
    ab = b - a
    length = float(np.linalg.norm(ab[:2]))
    if length < 1e-6:
        raise ValueError("Đường mặt cắt quá ngắn")

    direction = ab[:2] / length
    normal = np.array([-direction[1], direction[0]], dtype=np.float64)
    half_w = max(float(width), 0.01) / 2.0
    n = max(int(n_samples), 2)

    stations: list[float] = []
    z_min: list[float] = []
    z_max: list[float] = []
    z_mean: list[float] = []
    z_pts: list[list[float]] = []

    for i in range(n):
        t = i / (n - 1)
        center = a[:2] + direction * (length * t)
        rel = pts[:, :2] - center
        along = rel @ direction
        perp = np.abs(rel @ normal)
        in_strip = (perp <= half_w) & (along >= -half_w) & (along <= length + half_w)
        z_vals = pts[in_strip, 2] if np.any(in_strip) else np.array([], dtype=np.float64)

        stations.append(float(length * t))
        if len(z_vals) == 0:
            z_min.append(float("nan"))
            z_max.append(float("nan"))
            z_mean.append(float("nan"))
            z_pts.append([])
        else:
            z_min.append(float(np.min(z_vals)))
            z_max.append(float(np.max(z_vals)))
            z_mean.append(float(np.mean(z_vals)))
            z_pts.append(z_vals.tolist())

    return {
        "start": [float(x) for x in a],
        "end": [float(x) for x in b],
        "length_m": length,
        "width_m": float(width),
        "stations_m": stations,
        "z_min": z_min,
        "z_max": z_max,
        "z_mean": z_mean,
        "z_points": z_pts,
    }


def _interp_z(grid: np.ndarray, ix: float, iy: float) -> float:
    ny, nx = grid.shape
    if ix < 0 or iy < 0 or ix >= nx - 1 or iy >= ny - 1:
        return float("nan")
    x0, y0 = int(ix), int(iy)
    fx, fy = ix - x0, iy - y0
    z00, z10 = grid[y0, x0], grid[y0, x0 + 1]
    z01, z11 = grid[y0 + 1, x0], grid[y0 + 1, x0 + 1]
    if any(math.isnan(v) for v in (z00, z10, z01, z11)):
        return float("nan")
    return float(
        z00 * (1 - fx) * (1 - fy)
        + z10 * fx * (1 - fy)
        + z01 * (1 - fx) * fy
        + z11 * fx * fy
    )


def contour_lines_from_grid(grid_data: dict, interval: float = 1.0) -> dict:
    """Marching squares contours from IDW grid (TREND-POINT 等高線)."""
    values = np.asarray(grid_data["values"], dtype=np.float64)
    xs = np.asarray(grid_data["xs"], dtype=np.float64)
    ys = np.asarray(grid_data["ys"], dtype=np.float64)
    cell = float(grid_data.get("cell_size", 1.0))
    ny, nx = values.shape

    valid = values[~np.isnan(values)]
    if len(valid) == 0:
        raise ValueError("Lưới không có giá trị cao độ hợp lệ")

    z_min = float(np.min(valid))
    z_max = float(np.max(valid))
    step = max(float(interval), 0.01)
    levels = np.arange(
        math.ceil(z_min / step) * step,
        z_max + step * 0.5,
        step,
    )

    segments_by_level: dict[str, list[list[list[float]]]] = {}

    for level in levels:
        lv = float(level)
        segs: list[list[list[float]]] = []

        for iy in range(ny - 1):
            for ix in range(nx - 1):
                z = [
                    values[iy, ix],
                    values[iy, ix + 1],
                    values[iy + 1, ix + 1],
                    values[iy + 1, ix],
                ]
                if any(math.isnan(v) for v in z):
                    continue
                case = 0
                for i, v in enumerate(z):
                    if v >= lv:
                        case |= 1 << i

                if case in (0, 15):
                    continue

                x0, x1 = xs[ix], xs[ix + 1] if ix + 1 < len(xs) else xs[ix] + cell
                y0, y1 = ys[iy], ys[iy + 1] if iy + 1 < len(ys) else ys[iy] + cell

                def lerp(a: float, b: float, za: float, zb: float) -> tuple[float, float]:
                    if abs(zb - za) < 1e-12:
                        return (a + b) / 2, (y0 + y1) / 2
                    t = (lv - za) / (zb - za)
                    return a + t * (b - a), y0 + t * (y1 - y0)

                pts_edge: list[tuple[float, float, float]] = []

                if (case & 3) == 1 or (case & 3) == 2:
                    x = lerp(x0, x1, z[0], z[1])[0]
                    pts_edge.append((x, y0, lv))
                if (case & 6) == 2 or (case & 6) == 4:
                    y = lerp(y0, y1, z[1], z[2])[1]
                    pts_edge.append((x1, y, lv))
                if (case & 12) == 4 or (case & 12) == 8:
                    x = lerp(x0, x1, z[3], z[2])[0]
                    pts_edge.append((x, y1, lv))
                if (case & 9) == 1 or (case & 9) == 8:
                    y = lerp(y0, y1, z[0], z[3])[1]
                    pts_edge.append((x0, y, lv))

                if len(pts_edge) >= 2:
                    p0 = [pts_edge[0][0], pts_edge[0][1], lv]
                    p1 = [pts_edge[1][0], pts_edge[1][1], lv]
                    segs.append([p0, p1])

        if segs:
            segments_by_level[f"{lv:.3f}"] = segs

    return {
        "interval_m": step,
        "z_min": z_min,
        "z_max": z_max,
        "levels": [float(l) for l in levels],
        "segments": segments_by_level,
        "segment_count": sum(len(v) for v in segments_by_level.values()),
    }


def compute_grid_volume(grid_data: dict, base_z: float) -> dict:
    """Cut/fill volume from IDW grid vs reference elevation (TREND-POINT 土量)."""
    values = np.asarray(grid_data["values"], dtype=np.float64)
    cell = float(grid_data.get("cell_size", 1.0))
    area = cell * cell

    valid = ~np.isnan(values)
    if not np.any(valid):
        raise ValueError("Lưới không có dữ liệu cao độ")

    diff = values[valid] - float(base_z)
    cut = float(np.sum(np.where(diff < 0, -diff, 0) * area))
    fill = float(np.sum(np.where(diff > 0, diff, 0) * area))
    net = fill - cut
    cells = int(np.sum(valid))

    return {
        "base_z": float(base_z),
        "cell_size_m": cell,
        "cell_area_m2": area,
        "valid_cells": cells,
        "cut_m3": cut,
        "fill_m3": fill,
        "net_m3": net,
        "avg_elevation_m": float(np.mean(values[valid])),
        "min_elevation_m": float(np.min(values[valid])),
        "max_elevation_m": float(np.max(values[valid])),
    }


def compute_region_density(
    points: np.ndarray,
    min_pt: list[float],
    max_pt: list[float],
    cell_size: float,
) -> dict:
    """Point density per cell in region (TREND-POINT 密度確認)."""
    pts = np.asarray(points, dtype=np.float64)
    mn = np.asarray(min_pt[:3], dtype=np.float64)
    mx = np.asarray(max_pt[:3], dtype=np.float64)
    cell = max(float(cell_size), 0.01)

    mask = np.all((pts >= mn) & (pts <= mx), axis=1)
    region_pts = pts[mask]
    total = len(region_pts)
    if total == 0:
        return {
            "total_points": 0,
            "cell_size_m": cell,
            "cells": [],
            "avg_density_pts_per_m2": 0.0,
            "min_density": 0,
            "max_density": 0,
        }

    nx = max(1, int(math.ceil((mx[0] - mn[0]) / cell)))
    ny = max(1, int(math.ceil((mx[1] - mn[1]) / cell)))
    counts = np.zeros((ny, nx), dtype=np.int32)

    for p in region_pts:
        ix = min(int((p[0] - mn[0]) / cell), nx - 1)
        iy = min(int((p[1] - mn[1]) / cell), ny - 1)
        counts[iy, ix] += 1

    area = cell * cell
    flat = counts.flatten()
    cells = []
    for iy in range(ny):
        for ix in range(nx):
            c = int(counts[iy, ix])
            if c > 0:
                cells.append(
                    {
                        "ix": ix,
                        "iy": iy,
                        "x": float(mn[0] + (ix + 0.5) * cell),
                        "y": float(mn[1] + (iy + 0.5) * cell),
                        "count": c,
                        "density_pts_per_m2": c / area,
                    }
                )

    return {
        "total_points": total,
        "cell_size_m": cell,
        "region_min": [float(x) for x in mn],
        "region_max": [float(x) for x in mx],
        "cells": cells,
        "avg_density_pts_per_m2": float(total / max((mx[0] - mn[0]) * (mx[1] - mn[1]), 1e-6)),
        "min_density": int(np.min(flat)),
        "max_density": int(np.max(flat)),
    }


def point_in_polygon_xy(x: float, y: float, polygon: np.ndarray) -> bool:
    """Ray-casting point-in-polygon test (XY plane)."""
    inside = False
    n = len(polygon)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = float(polygon[i, 0]), float(polygon[i, 1])
        xj, yj = float(polygon[j, 0]), float(polygon[j, 1])
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-15) + xi:
            inside = not inside
        j = i
    return inside


def extract_tin_patch_inside_polygon(idw: dict, polygon: list[list[float]]) -> tuple[np.ndarray, np.ndarray]:
    """Extract TIN triangles inside a closed trace polygon (面抽出)."""
    from pointcloud_editor_ops import idw_grid_to_tin

    poly = np.asarray(polygon, dtype=np.float64)
    if poly.ndim != 2 or poly.shape[1] < 2 or len(poly) < 3:
        raise ValueError("Polygon trace cần ít nhất 3 điểm.")

    verts, tris = idw_grid_to_tin(idw)
    if len(tris) == 0:
        raise ValueError("Không có TIN để trích xuất.")

    keep: list[list[int]] = []
    for tri in tris:
        c = verts[tri].mean(axis=0)
        if point_in_polygon_xy(float(c[0]), float(c[1]), poly):
            keep.append(tri.tolist())

    if not keep:
        raise ValueError("Không có tam giác nào trong vùng trace.")

    used = sorted({i for tri in keep for i in tri})
    remap = {old: new for new, old in enumerate(used)}
    new_verts = verts[used]
    new_tris = np.asarray([[remap[i] for i in tri] for tri in keep], dtype=np.int32)
    return new_verts, new_tris
