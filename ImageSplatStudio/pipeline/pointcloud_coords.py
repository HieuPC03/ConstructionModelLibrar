"""Coordinate normalization and multi-file point cloud merging."""

from __future__ import annotations

from pathlib import Path

import numpy as np


def normalize_point_cloud(pcd):
    """Center at origin and scale to unit size — fixes LAS large coords and viewer alignment."""
    import open3d as o3d

    pts = np.asarray(pcd.points, dtype=np.float64)
    if len(pts) == 0:
        return pcd, {"center": [0, 0, 0], "scale": 1.0}

    center = pts.mean(axis=0)
    pts = pts - center

    # GIS / LiDAR often Z-up; Three.js / splat viewers use Y-up — rotate X by -90°
    pts = np.stack([pts[:, 0], pts[:, 2], -pts[:, 1]], axis=1)

    extent = np.max(np.abs(pts), axis=0)
    max_dim = float(np.max(extent))
    scale = 1.0 if max_dim < 1e-9 else 2.0 / max_dim
    pts = pts * scale

    out = o3d.geometry.PointCloud()
    out.points = o3d.utility.Vector3dVector(pts)
    if pcd.has_colors():
        out.colors = pcd.colors
    meta = {
        "center": center.tolist(),
        "scale": scale,
        "axis_fix": "z_up_to_y_up",
    }
    return out, meta


def merge_point_cloud_files(paths: list[Path]):
    import open3d as o3d

    from pointcloud_io import load_point_cloud_file

    if not paths:
        raise ValueError("Không có file point cloud")

    merged = o3d.geometry.PointCloud()
    all_pts: list[np.ndarray] = []
    all_cols: list[np.ndarray] = []

    for path in paths:
        loaded = load_point_cloud_file(path)
        if isinstance(loaded, tuple) and loaded[0] == "3dgs_ply":
            from plyfile import PlyData

            ply = PlyData.read(str(loaded[1]))
            vertex = ply["vertex"]
            xs = np.asarray(vertex["x"], dtype=np.float64)
            ys = np.asarray(vertex["y"], dtype=np.float64)
            zs = np.asarray(vertex["z"], dtype=np.float64)
            all_pts.append(np.stack([xs, ys, zs], axis=1))
            names = vertex.data.dtype.names or ()
            if "red" in names:
                all_cols.append(
                    np.stack(
                        [
                            np.asarray(vertex["red"], dtype=np.float64) / 255.0,
                            np.asarray(vertex["green"], dtype=np.float64) / 255.0,
                            np.asarray(vertex["blue"], dtype=np.float64) / 255.0,
                        ],
                        axis=1,
                    )
                )
            continue

        pts = np.asarray(loaded.points, dtype=np.float64)
        all_pts.append(pts)
        if loaded.has_colors():
            all_cols.append(np.asarray(loaded.colors, dtype=np.float64))

    if not all_pts:
        raise ValueError("Không đọc được điểm từ các file")

    combined = np.vstack(all_pts)
    merged.points = o3d.utility.Vector3dVector(combined)
    if all_cols and sum(len(c) for c in all_cols) == len(combined):
        merged.colors = o3d.utility.Vector3dVector(np.vstack(all_cols))

    return normalize_point_cloud(merged)


def merge_point_cloud_files_with_info(paths: list[Path]) -> tuple:
    """Merge files and return (pcd, norm_meta, files_info)."""
    import open3d as o3d

    from pointcloud_io import load_point_cloud_file

    if not paths:
        raise ValueError("Không có file point cloud")

    all_pts: list[np.ndarray] = []
    all_cols: list[np.ndarray] = []
    files_info: list[dict] = []
    offset = 0

    for path in paths:
        loaded = load_point_cloud_file(path)
        if isinstance(loaded, tuple) and loaded[0] == "3dgs_ply":
            from plyfile import PlyData

            ply = PlyData.read(str(loaded[1]))
            vertex = ply["vertex"]
            xs = np.asarray(vertex["x"], dtype=np.float64)
            ys = np.asarray(vertex["y"], dtype=np.float64)
            zs = np.asarray(vertex["z"], dtype=np.float64)
            pts = np.stack([xs, ys, zs], axis=1)
            cols = None
            names = vertex.data.dtype.names or ()
            if "red" in names:
                cols = np.stack(
                    [
                        np.asarray(vertex["red"], dtype=np.float64) / 255.0,
                        np.asarray(vertex["green"], dtype=np.float64) / 255.0,
                        np.asarray(vertex["blue"], dtype=np.float64) / 255.0,
                    ],
                    axis=1,
                )
        else:
            pts = np.asarray(loaded.points, dtype=np.float64)
            cols = np.asarray(loaded.colors, dtype=np.float64) if loaded.has_colors() else None

        count = len(pts)
        files_info.append(
            {
                "name": path.name,
                "format": path.suffix.lower().lstrip(".") or "unknown",
                "point_count": int(count),
                "size_bytes": int(path.stat().st_size) if path.exists() else 0,
                "start_index": int(offset),
                "visible": True,
            }
        )
        offset += count
        all_pts.append(pts)
        if cols is not None:
            all_cols.append(cols)

    if not all_pts:
        raise ValueError("Không đọc được điểm từ các file")

    merged = o3d.geometry.PointCloud()
    combined = np.vstack(all_pts)
    merged.points = o3d.utility.Vector3dVector(combined)
    if all_cols and sum(len(c) for c in all_cols) == len(combined):
        merged.colors = o3d.utility.Vector3dVector(np.vstack(all_cols))

    pcd, meta = normalize_point_cloud(merged)
    return pcd, meta, files_info


def sample_fraction(points: np.ndarray, fraction: float, seed: int = 42) -> np.ndarray:
    total = len(points)
    if total == 0:
        return points
    count = max(1, int(total * fraction))
    if count >= total:
        return np.arange(total)
    rng = np.random.default_rng(seed)
    return rng.choice(total, count, replace=False)
