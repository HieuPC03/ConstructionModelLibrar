"""Shared point cloud loaders for pipeline scripts."""

from __future__ import annotations

from pathlib import Path


def is_3dgs_ply_header(header_text: str) -> bool:
    lower = header_text.lower()
    return "scale_0" in lower and "opacity" in lower and ("f_dc_0" in lower or "red" in lower)


def load_las_point_cloud(path: Path):
    import numpy as np
    import open3d as o3d

    try:
        import laspy
    except ImportError as exc:
        raise ValueError("laspy chưa được cài. Chạy: pip install laspy lazrs") from exc

    las = laspy.read(str(path))
    x = np.asarray(las.x, dtype=np.float64)
    y = np.asarray(las.y, dtype=np.float64)
    z = np.asarray(las.z, dtype=np.float64)
    points = np.stack([x, y, z], axis=1)

    if len(points) == 0:
        raise ValueError("File LAS/LAZ rỗng")

    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(points)

    dim_names = set(las.point_format.dimension_names)
    if {"red", "green", "blue"}.issubset(dim_names):
        r = np.asarray(las.red, dtype=np.float64)
        g = np.asarray(las.green, dtype=np.float64)
        b = np.asarray(las.blue, dtype=np.float64)
        peak = max(float(r.max(initial=0)), float(g.max(initial=0)), float(b.max(initial=0)), 1.0)
        scale = 65535.0 if peak > 255 else 255.0
        colors = np.stack([r / scale, g / scale, b / scale], axis=1)
        pcd.colors = o3d.utility.Vector3dVector(colors)
    elif "intensity" in dim_names:
        intensity = np.asarray(las.intensity, dtype=np.float64)
        peak = float(intensity.max(initial=1.0)) or 1.0
        gray = np.clip(intensity / peak, 0, 1)
        pcd.colors = o3d.utility.Vector3dVector(np.stack([gray, gray, gray], axis=1))

    return pcd


def load_xyz_point_cloud(path: Path):
    import numpy as np
    import open3d as o3d

    data = np.loadtxt(str(path))
    if data.ndim == 1:
        raise ValueError("XYZ file must have at least 3 columns")
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(data[:, :3])
    if data.shape[1] >= 6:
        cols = data[:, 3:6]
        if cols.max() > 1:
            cols = cols / 255.0
        pcd.colors = o3d.utility.Vector3dVector(cols)
    return pcd


def load_point_cloud_file(path: Path):
    """Load point cloud from PLY, PCD, LAS/LAZ, XYZ, OBJ, etc."""
    import open3d as o3d

    suffix = path.suffix.lower()
    if suffix in {".xyz", ".pts", ".txt"}:
        return load_xyz_point_cloud(path)

    if suffix in {".las", ".laz"}:
        return load_las_point_cloud(path)

    if suffix == ".ply":
        header = path.read_bytes()[:8192].decode("ascii", errors="ignore")
        if is_3dgs_ply_header(header):
            return ("3dgs_ply", path)

    pcd = o3d.io.read_point_cloud(str(path))
    if pcd.is_empty() and suffix == ".obj":
        mesh = o3d.io.read_triangle_mesh(str(path))
        if not mesh.is_empty():
            pcd = mesh.sample_points_uniformly(number_of_points=max(len(mesh.vertices) * 3, 5000))
    if pcd.is_empty():
        raise ValueError(f"Không đọc được point cloud: {path.name}")
    return pcd
