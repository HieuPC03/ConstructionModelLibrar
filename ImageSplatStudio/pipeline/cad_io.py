"""FBX, DXF, DWG → point cloud loaders."""

from __future__ import annotations

import re
from pathlib import Path

import numpy as np


def _mesh_to_pointcloud(vertices: np.ndarray, faces: np.ndarray | None = None, sample: int | None = None):
    import open3d as o3d

    if len(vertices) == 0:
        raise ValueError("Không có đỉnh trong mô hình 3D")

    if faces is not None and len(faces) > 0:
        mesh = o3d.geometry.TriangleMesh()
        mesh.vertices = o3d.utility.Vector3dVector(vertices.astype(np.float64))
        mesh.triangles = o3d.utility.Vector3iVector(faces.astype(np.int32))
        n = sample or max(len(vertices) * 2, 5000)
        pcd = mesh.sample_points_uniformly(number_of_points=min(n, 500_000))
        return pcd

    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(vertices.astype(np.float64))
    return pcd


def _load_fbx_ascii_vertices(path: Path) -> np.ndarray:
    text = path.read_text(encoding="utf-8", errors="ignore")
    verts: list[list[float]] = []
    in_vertices = False
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("Vertices:"):
            in_vertices = True
            continue
        if in_vertices:
            if line.startswith("}"):
                break
            nums = re.findall(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?", line)
            for i in range(0, len(nums) - 2, 3):
                verts.append([float(nums[i]), float(nums[i + 1]), float(nums[i + 2])])
    if not verts:
        raise ValueError("Không đọc được đỉnh FBX ASCII")
    return np.asarray(verts, dtype=np.float64)


def load_fbx_point_cloud(path: Path):
    """Load FBX mesh and sample to point cloud."""
    try:
        import trimesh

        loaded = trimesh.load(str(path), force="mesh", skip_materials=True)
        if isinstance(loaded, trimesh.Scene):
            meshes = [g for g in loaded.geometry.values() if isinstance(g, trimesh.Trimesh)]
            if not meshes:
                raise ValueError("FBX không chứa mesh")
            combined = trimesh.util.concatenate(meshes) if len(meshes) > 1 else meshes[0]
        elif isinstance(loaded, trimesh.Trimesh):
            combined = loaded
        else:
            raise ValueError("FBX không phải mesh 3D")

        n = max(len(combined.vertices) * 2, 5000)
        pts = combined.sample(min(n, 500_000))
        return _mesh_to_pointcloud(np.asarray(pts, dtype=np.float64))
    except Exception:
        pass

    try:
        verts = _load_fbx_ascii_vertices(path)
        return _mesh_to_pointcloud(verts)
    except Exception as exc:
        raise ValueError(
            f"Không đọc được FBX: {path.name}. Cần mesh FBX ASCII hoặc cài trimesh+assimp."
        ) from exc


def _dxf_entity_points(entity) -> list[list[float]]:
    dt = entity.dxftype()
    out: list[list[float]] = []
    if dt == "POINT":
        p = entity.dxf.location
        out.append([float(p.x), float(p.y), float(getattr(p, "z", 0) or 0)])
    elif dt == "LINE":
        for p in (entity.dxf.start, entity.dxf.end):
            out.append([float(p.x), float(p.y), float(getattr(p, "z", 0) or 0)])
    elif dt == "3DFACE":
        for attr in ("vtx0", "vtx1", "vtx2", "vtx3"):
            if hasattr(entity.dxf, attr):
                v = getattr(entity.dxf, attr)
                out.append([float(v.x), float(v.y), float(getattr(v, "z", 0) or 0)])
    elif dt == "LWPOLYLINE":
        elev = float(getattr(entity.dxf, "elevation", 0) or 0)
        for x, y, *_ in entity.get_points("xy"):
            out.append([float(x), float(y), elev])
    elif dt == "POLYLINE":
        for v in entity.vertices:
            loc = v.dxf.location
            out.append([float(loc.x), float(loc.y), float(getattr(loc, "z", 0) or 0)])
    elif dt == "MESH":
        for v in entity.vertices:
            out.append([float(v[0]), float(v[1]), float(v[2]) if len(v) > 2 else 0.0])
    return out


def load_dxf_point_cloud(path: Path):
    import ezdxf

    try:
        doc = ezdxf.readfile(str(path))
    except ezdxf.DXFStructureError as exc:
        raise ValueError(f"DXF không hợp lệ: {path.name}") from exc

    points: list[list[float]] = []
    for entity in doc.modelspace():
        points.extend(_dxf_entity_points(entity))

    if not points:
        raise ValueError(f"Không có geometry trong DXF: {path.name}")

    verts = np.asarray(points, dtype=np.float64)
    return _mesh_to_pointcloud(verts)


def load_dwg_point_cloud(path: Path):
    """Load DWG via ezdxf ODA addon when available, else instruct to convert to DXF."""
    try:
        from ezdxf.addons import odafc

        if not odafc.is_installed():
            raise ValueError(
                "DWG cần ODA File Converter trên máy Windows. "
                "Hoặc xuất file sang DXF rồi import lại."
            )
        doc = odafc.readfile(str(path))
    except ImportError as exc:
        raise ValueError(
            "Không hỗ trợ đọc DWG trực tiếp trên môi trường này. Vui lòng chuyển sang DXF."
        ) from exc
    except Exception as exc:
        raise ValueError(
            f"Không đọc được DWG: {path.name}. Hãy lưu sang DXF (AutoCAD: SAVEAS DXF) rồi import."
        ) from exc

    points: list[list[float]] = []
    for entity in doc.modelspace():
        points.extend(_dxf_entity_points(entity))
    if not points:
        raise ValueError(f"Không có geometry trong DWG: {path.name}")
    verts = np.asarray(points, dtype=np.float64)
    return _mesh_to_pointcloud(verts)
