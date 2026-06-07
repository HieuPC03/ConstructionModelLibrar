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
    max_neighbors: int = 24,
    search_radius_factor: float = 2.5,
    surface_mode: str = "idw",
) -> dict:
    """Create elevation grid from point cloud using inverse distance weighting (TREND-POINT style)."""
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
    search_r2 = (cell * search_radius_factor) ** 2
    half_cell2 = (cell * 0.5) ** 2

    for iy, y in enumerate(ys):
        for ix, x in enumerate(xs):
            dx = pts[:, 0] - x
            dy = pts[:, 1] - y
            dist2 = dx * dx + dy * dy

            in_cell = dist2 < half_cell2
            if np.any(in_cell):
                z_in = pts[in_cell, 2]
                if surface_mode == "min_z":
                    values[iy, ix] = float(np.min(z_in))
                elif surface_mode == "mean_z":
                    values[iy, ix] = float(np.mean(z_in))
                else:
                    values[iy, ix] = float(np.mean(z_in))
                continue

            nearby = dist2 <= search_r2
            if np.any(nearby):
                idx = np.where(nearby)[0]
            else:
                idx = np.argsort(dist2)[:max_neighbors]

            d = np.sqrt(dist2[idx] + 1e-12)
            z = pts[idx, 2]
            if surface_mode == "min_z":
                values[iy, ix] = float(np.min(z))
            else:
                w = 1.0 / np.power(d, power)
                values[iy, ix] = float(np.sum(w * z) / np.sum(w))

    values = fill_nan_grid_2d(values)

    return {
        "cell_size": cell,
        "origin": [float(mn[0]), float(mn[1])],
        "size": [int(nx), int(ny)],
        "xs": xs.tolist(),
        "ys": ys.tolist(),
        "values": values.tolist(),
        "surface_mode": surface_mode,
    }


def fill_nan_grid_2d(values: np.ndarray, max_passes: int = 12) -> np.ndarray:
    """Fill NaN cells by averaging valid 4-neighbors (hole filling for TIN)."""
    out = np.asarray(values, dtype=np.float64).copy()
    ny, nx = out.shape
    for _ in range(max_passes):
        nan_mask = np.isnan(out)
        if not np.any(nan_mask):
            break
        filled = out.copy()
        for iy in range(ny):
            for ix in range(nx):
                if not np.isnan(out[iy, ix]):
                    continue
                neighbors = []
                if iy > 0 and not np.isnan(out[iy - 1, ix]):
                    neighbors.append(out[iy - 1, ix])
                if iy + 1 < ny and not np.isnan(out[iy + 1, ix]):
                    neighbors.append(out[iy + 1, ix])
                if ix > 0 and not np.isnan(out[iy, ix - 1]):
                    neighbors.append(out[iy, ix - 1])
                if ix + 1 < nx and not np.isnan(out[iy, ix + 1]):
                    neighbors.append(out[iy, ix + 1])
                if neighbors:
                    filled[iy, ix] = float(np.mean(neighbors))
        out = filled
    return out


def idw_grid_to_tin(idw: dict) -> tuple[np.ndarray, np.ndarray]:
    """Triangulate IDW grid into TIN mesh (2 triangles per cell) — TREND-POINT 三角網."""
    nx, ny = idw["size"]
    xs = np.asarray(idw["xs"], dtype=np.float64)
    ys = np.asarray(idw["ys"], dtype=np.float64)
    values = np.asarray(idw["values"], dtype=np.float64)

    vi_map: dict[tuple[int, int], int] = {}
    vertices: list[list[float]] = []

    def vertex_index(iy: int, ix: int) -> int | None:
        if iy < 0 or ix < 0 or iy >= ny or ix >= nx:
            return None
        z = values[iy, ix]
        if np.isnan(z):
            return None
        key = (iy, ix)
        if key not in vi_map:
            vi_map[key] = len(vertices)
            vertices.append([float(xs[ix]), float(ys[iy]), float(z)])
        return vi_map[key]

    triangles: list[list[int]] = []
    for iy in range(ny - 1):
        for ix in range(nx - 1):
            i00 = vertex_index(iy, ix)
            i10 = vertex_index(iy, ix + 1)
            i01 = vertex_index(iy + 1, ix)
            i11 = vertex_index(iy + 1, ix + 1)
            corners = [i00, i10, i11, i01]
            valid = [c for c in corners if c is not None]
            if len(valid) == 4:
                a, b, c, d = i00, i10, i11, i01  # type: ignore
                triangles.append([a, b, c])
                triangles.append([a, c, d])
            elif len(valid) == 3:
                triangles.append(valid)

    if not vertices:
        raise ValueError("Không tạo được TIN — lưới IDW rỗng hoặc toàn NaN.")
    return np.asarray(vertices, dtype=np.float64), np.asarray(triangles, dtype=np.int32)


def mesh_from_idw_surface(
    points: np.ndarray,
    colors: np.ndarray | None,
    output_path: Path,
    *,
    bbox_min: np.ndarray,
    bbox_max: np.ndarray,
    cell_size: float = 0.2,
    surface_mode: str = "idw",
    snap_to_points: bool = True,
) -> dict:
    """Terrain mesh via IDW surface interpolation → TIN (TREND-POINT workflow)."""
    import open3d as o3d

    idw = create_idw_grid(
        points,
        bbox_min,
        bbox_max,
        cell_size,
        surface_mode=surface_mode,
    )

    if snap_to_points:
        _snap_idw_to_points(idw, points, cell_size)

    verts, tris = idw_grid_to_tin(idw)
    mesh = o3d.geometry.TriangleMesh(
        o3d.utility.Vector3dVector(verts),
        o3d.utility.Vector3iVector(tris),
    )
    mesh.compute_vertex_normals()
    mesh.paint_uniform_color([0.72, 0.78, 0.86])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not o3d.io.write_triangle_mesh(str(output_path), mesh, write_vertex_colors=True):
        raise RuntimeError("Không ghi được file mesh.")

    return {
        "vertices": int(len(mesh.vertices)),
        "triangles": int(len(mesh.triangles)),
        "method": "idw",
        "cell_size": float(cell_size),
        "grid_size": idw["size"],
    }


def _snap_idw_to_points(idw: dict, points: np.ndarray, cell_size: float) -> None:
    """Refine grid nodes with survey points inside each cell (honour measurements)."""
    pts = np.asarray(points, dtype=np.float64)
    xs = np.asarray(idw["xs"], dtype=np.float64)
    ys = np.asarray(idw["ys"], dtype=np.float64)
    values = np.asarray(idw["values"], dtype=np.float64)
    half = cell_size * 0.5
    ny, nx = values.shape

    for iy, y in enumerate(ys):
        for ix, x in enumerate(xs):
            mask = (
                (np.abs(pts[:, 0] - x) <= half)
                & (np.abs(pts[:, 1] - y) <= half)
            )
            if np.any(mask):
                values[iy, ix] = float(np.mean(pts[mask, 2]))
    idw["values"] = values.tolist()


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


def mesh_from_points(
    points: np.ndarray,
    colors: np.ndarray | None,
    output_path: Path,
    *,
    method="idw",
    depth=8,
    cell_size: float = 0.2,
    bbox_min: np.ndarray | None = None,
    bbox_max: np.ndarray | None = None,
):
    """Create mesh from points. Default: IDW surface → TIN (TREND-POINT)."""
    pts = np.asarray(points, dtype=np.float64)
    if len(pts) < 4:
        raise ValueError("Quá ít điểm để tạo mesh (cần ≥ 4).")

    if method in ("idw", "surface", "tin"):
        mn = np.min(pts, axis=0) if bbox_min is None else np.asarray(bbox_min, dtype=np.float64)
        mx = np.max(pts, axis=0) if bbox_max is None else np.asarray(bbox_max, dtype=np.float64)
        return mesh_from_idw_surface(
            pts,
            colors,
            output_path,
            bbox_min=mn,
            bbox_max=mx,
            cell_size=cell_size,
        )

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
        "method": method,
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
        "view": {"show_axes": True, "fov": 50, "color_mode": "rgb", "show_grid_surface": False},
        "hidden_class_ids": [],
    }


def save_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))
