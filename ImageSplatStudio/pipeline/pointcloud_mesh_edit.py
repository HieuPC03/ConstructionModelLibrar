"""Edit triangle mesh: add/delete vertices, breaklines."""

from __future__ import annotations

from pathlib import Path

import numpy as np


def load_mesh(path: Path):
    import open3d as o3d

    mesh = o3d.io.read_triangle_mesh(str(path))
    if mesh.is_empty():
        raise ValueError("Mesh rỗng")
    return mesh


def save_mesh(mesh, path: Path) -> None:
    import open3d as o3d

    path.parent.mkdir(parents=True, exist_ok=True)
    if not o3d.io.write_triangle_mesh(str(path), mesh, write_vertex_colors=True):
        raise RuntimeError("Không ghi được mesh.")


def add_mesh_vertex(path: Path, position: list[float]) -> dict:
    mesh = load_mesh(path)
    verts = np.asarray(mesh.vertices, dtype=np.float64)
    new_v = np.asarray(position, dtype=np.float64).reshape(1, 3)
    combined = np.vstack([verts, new_v])
    mesh.vertices = combined
    mesh.compute_vertex_normals()
    save_mesh(mesh, path)
    return {"vertices": int(len(combined)), "triangles": int(len(mesh.triangles)), "added_index": int(len(combined) - 1)}


def delete_mesh_vertex(path: Path, vertex_index: int) -> dict:
    mesh = load_mesh(path)
    n = len(mesh.vertices)
    if vertex_index < 0 or vertex_index >= n:
        raise ValueError("Vertex index không hợp lệ.")
    tris = np.asarray(mesh.triangles, dtype=np.int64)
    keep_v = np.ones(n, dtype=bool)
    keep_v[vertex_index] = False
    if len(tris) > 0:
        keep_t = ~np.any(tris == vertex_index, axis=1)
        tris = tris[keep_t]
    import open3d as o3d

    new_verts = np.asarray(mesh.vertices, dtype=np.float64)[keep_v]
    remap = np.full(n, -1, dtype=np.int64)
    remap[np.where(keep_v)[0]] = np.arange(len(new_verts))
    mesh.vertices = o3d.utility.Vector3dVector(new_verts)
    if len(tris) > 0:
        valid = np.all(tris >= 0, axis=1)
        tris = tris[valid]
        if len(tris) > 0:
            tris = remap[tris]
            mesh.triangles = o3d.utility.Vector3iVector(tris)
    mesh.remove_unreferenced_vertices()
    mesh.compute_vertex_normals()
    save_mesh(mesh, path)
    return {"vertices": int(len(mesh.vertices)), "triangles": int(len(mesh.triangles))}


def delete_points_near(points: np.ndarray, colors: np.ndarray | None, center: list[float], radius: float):
    pts = np.asarray(points, dtype=np.float32)
    c = np.asarray(center, dtype=np.float32)
    dist = np.linalg.norm(pts - c, axis=1)
    keep = dist > float(radius)
    new_pts = pts[keep]
    new_cols = colors[keep] if colors is not None and len(colors) == len(pts) else None
    removed = int(np.sum(~keep))
    return new_pts, new_cols, removed


def add_point(points: np.ndarray, colors: np.ndarray | None, position: list[float], color: list[float] | None = None):
    import numpy as np

    pts = np.asarray(points, dtype=np.float32)
    new_pt = np.asarray(position, dtype=np.float32).reshape(1, 3)
    new_pts = np.vstack([pts, new_pt])
    if colors is not None and len(colors) == len(pts):
        if color:
            c = np.asarray(color, dtype=np.float32).reshape(1, 3)
        else:
            c = np.asarray([[0.9, 0.3, 0.3]], dtype=np.float32)
        new_cols = np.vstack([colors, c])
    else:
        new_cols = None
    return new_pts, new_cols
