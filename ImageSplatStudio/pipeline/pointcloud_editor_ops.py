"""Point cloud editing operations: grid, mesh, split, filter."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np


def _frange(start: float, stop: float, step: float) -> list[float]:
    n = int(np.ceil((stop - start) / step)) + 1
    return [start + i * step for i in range(n)]


def build_plan_grid_lines(
    bbox_min: np.ndarray,
    bbox_max: np.ndarray,
    cell_size: float,
    *,
    z_level: float | None = None,
) -> np.ndarray:
    """TREND-POINT style XY plan grid at a single Z level (Z-up)."""
    cell = max(float(cell_size), 1e-6)
    mn = np.asarray(bbox_min, dtype=np.float64)
    mx = np.asarray(bbox_max, dtype=np.float64)
    z = float(mn[2] if z_level is None else z_level)
    lines: list[list[list[float]]] = []

    for x in _frange(mn[0], mx[0], cell):
        lines.append([[x, mn[1], z], [x, mx[1], z]])
    for y in _frange(mn[1], mx[1], cell):
        lines.append([[mn[0], y, z], [mx[0], y, z]])

    return np.asarray(lines, dtype=np.float32)


def build_square_grid_lines(
    bbox_min: np.ndarray,
    bbox_max: np.ndarray,
    cell_size: float,
) -> np.ndarray:
    """Return Nx2x3 line segments for a plan grid (TREND-POINT style)."""
    return build_plan_grid_lines(bbox_min, bbox_max, cell_size)


def create_idw_grid(
    points: np.ndarray,
    bbox_min: np.ndarray,
    bbox_max: np.ndarray,
    cell_size: float,
    *,
    power: float = 2.0,
    max_neighbors: int = 12,
) -> dict:
    """Create elevation grid from point cloud using inverse distance weighting."""
    cell = max(float(cell_size), 1e-6)
    mn = np.asarray(bbox_min, dtype=np.float64)
    mx = np.asarray(bbox_max, dtype=np.float64)
    pts = np.asarray(points, dtype=np.float64)
    if len(pts) == 0:
        raise ValueError("Không có điểm để tạo lưới")

    xs = np.arange(mn[0], mx[0] + cell * 0.5, cell)
    ys = np.arange(mn[1], mx[1] + cell * 0.5, cell)
    nx, ny = len(xs), len(ys)
    values = np.full((ny, nx), np.nan, dtype=np.float64)

    for iy, y in enumerate(ys):
        for ix, x in enumerate(xs):
            dx = pts[:, 0] - x
            dy = pts[:, 1] - y
            dist2 = dx * dx + dy * dy
            mask = dist2 < (cell * 0.5) ** 2
            if np.any(mask):
                values[iy, ix] = float(np.mean(pts[mask, 2]))
                continue
            order = np.argsort(dist2)[:max_neighbors]
            d = np.sqrt(dist2[order] + 1e-12)
            w = 1.0 / np.power(d, power)
            values[iy, ix] = float(np.sum(w * pts[order, 2]) / np.sum(w))

    return {
        "cell_size": cell,
        "origin": [float(mn[0]), float(mn[1])],
        "size": [int(nx), int(ny)],
        "xs": xs.tolist(),
        "ys": ys.tolist(),
        "values": values.tolist(),
    }


def apply_swap_xy(points: np.ndarray, meta: dict | None = None) -> np.ndarray:
    """Swap GIS X↔Y — requires norm_meta; legacy 2-arg call uses viewer swap (deprecated)."""
    if meta is not None:
        from pointcloud_transform import apply_swap_xy as _swap

        return _swap(points, meta)
    pts = np.asarray(points, dtype=np.float32).copy()
    pts[:, [0, 1]] = pts[:, [1, 0]]
    return pts


def compute_visibility_mask(total: int, state: dict, points: np.ndarray) -> np.ndarray:
    mask = np.ones(total, dtype=bool)
    for file_info in state.get("files", []):
        if file_info.get("visible", True):
            continue
        start = int(file_info.get("start_index", 0))
        count = int(file_info.get("point_count", 0))
        mask[start : start + count] = False

    for region in state.get("hidden_regions", []):
        if not region.get("hidden", True):
            continue
        mn = np.asarray(region["min"], dtype=np.float64)
        mx = np.asarray(region["max"], dtype=np.float64)
        inside = np.all((points >= mn) & (points <= mx), axis=1)
        mask &= ~inside
    return mask


def remove_statistical_outliers(points: np.ndarray, colors: np.ndarray | None, *, nb_neighbors=20, std_ratio=2.0):
    import open3d as o3d

    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(np.asarray(points, dtype=np.float64))
    if colors is not None:
        pcd.colors = o3d.utility.Vector3dVector(np.asarray(colors, dtype=np.float64))
    filtered, keep_idx = pcd.remove_statistical_outlier(nb_neighbors=nb_neighbors, std_ratio=std_ratio)
    idx = np.asarray(keep_idx, dtype=np.int64)
    new_pts = np.asarray(filtered.points, dtype=np.float32)
    new_cols = np.asarray(filtered.colors, dtype=np.float32) if filtered.has_colors() else None
    return new_pts, new_cols, idx


def split_by_axis(points: np.ndarray, colors: np.ndarray | None, axis: int, value: float):
    pts = np.asarray(points, dtype=np.float32)
    left = pts[:, axis] <= value
    right = ~left
    left_pts = pts[left]
    right_pts = pts[right]
    left_cols = colors[left] if colors is not None else None
    right_cols = colors[right] if colors is not None else None
    return (left_pts, left_cols), (right_pts, right_cols)


def mesh_from_points(points: np.ndarray, colors: np.ndarray | None, output_path: Path, *, method="poisson", depth=8):
    import open3d as o3d

    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(np.asarray(points, dtype=np.float64))
    if colors is not None and len(colors) == len(points):
        pcd.colors = o3d.utility.Vector3dVector(np.asarray(colors, dtype=np.float64))

    bbox = pcd.get_axis_aligned_bounding_box()
    extent = max(float(x) for x in bbox.get_extent())
    voxel_size = max(extent / 200.0, 0.001)
    pcd = pcd.voxel_down_sample(voxel_size)
    if len(pcd.points) < 100:
        raise ValueError("Quá ít điểm để tạo mesh (cần ≥ 100).")

    pcd, _ = pcd.remove_statistical_outlier(nb_neighbors=20, std_ratio=2.0)
    pcd.estimate_normals(search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=voxel_size * 4, max_nn=30))
    pcd.orient_normals_consistent_tangent_plane(k=30)

    if method == "bpa":
        distances = pcd.compute_nearest_neighbor_distance()
        avg_dist = float(np.mean(distances))
        radii = o3d.utility.DoubleVector([avg_dist, avg_dist * 2, avg_dist * 4])
        mesh = o3d.geometry.TriangleMesh.create_from_point_cloud_ball_pivoting(pcd, radii)
    else:
        mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(pcd, depth=depth)
        if len(densities) > 0:
            densities_np = np.asarray(densities)
            thr = float(np.quantile(densities_np, 0.02))
            mesh.remove_vertices_by_mask(densities_np < thr)

    mesh.remove_degenerate_triangles()
    mesh.remove_duplicated_triangles()
    mesh.remove_non_manifold_edges()
    if len(mesh.vertices) == 0:
        raise ValueError("Không tạo được lưới tam giác.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not o3d.io.write_triangle_mesh(str(output_path), mesh, write_vertex_colors=True):
        raise RuntimeError("Không ghi được file mesh.")
    return {
        "vertices": int(len(mesh.vertices)),
        "triangles": int(len(mesh.triangles)),
    }


def pack_grid_lines(lines: np.ndarray) -> bytes:
    count = len(lines)
    header = np.array([count], dtype=np.uint32).tobytes()
    return header + np.asarray(lines, dtype=np.float32).tobytes()


def unpack_grid_lines(data: bytes) -> np.ndarray:
    count = int(np.frombuffer(data[:4], dtype=np.uint32)[0])
    return np.frombuffer(data[4:], dtype=np.float32).reshape(count, 2, 3)


def default_state(*, files: list[dict], norm_meta: dict) -> dict:
    return {
        "files": files,
        "norm_meta": norm_meta,
        "swap_xy": False,
        "hidden_regions": [],
        "grid": {"enabled": False, "cell_size": 0.2, "region": None, "method": "idw", "has_data": False},
        "mesh": None,
        "breaklines": [],
        "coord_points": [],
        "measurements": [],
        "undo_stack": [],
        "redo_stack": [],
        "crs": {"epsg": 6668, "name": "JGD2011 (Latitude-Longitude)"},
        "basemap": {"enabled": False, "mode": "aerial"},
        "view": {"show_axes": True, "fov": 50},
    }


def save_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))
