"""FBX, DXF, DWG → point cloud loaders."""

from __future__ import annotations

import math
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


def _append_point(out: list[list[float]], x, y, z=0.0) -> None:
    out.append([float(x), float(y), float(z if z is not None else 0.0)])


def _dxf_entity_points(entity) -> list[list[float]]:
    dt = entity.dxftype()
    out: list[list[float]] = []
    if dt == "POINT":
        p = entity.dxf.location
        _append_point(out, p.x, p.y, getattr(p, "z", 0) or 0)
    elif dt == "LINE":
        for p in (entity.dxf.start, entity.dxf.end):
            _append_point(out, p.x, p.y, getattr(p, "z", 0) or 0)
    elif dt == "3DFACE":
        for attr in ("vtx0", "vtx1", "vtx2", "vtx3"):
            if hasattr(entity.dxf, attr):
                v = getattr(entity.dxf, attr)
                _append_point(out, v.x, v.y, getattr(v, "z", 0) or 0)
    elif dt == "LWPOLYLINE":
        elev = float(getattr(entity.dxf, "elevation", 0) or 0)
        for x, y, *_ in entity.get_points("xy"):
            _append_point(out, x, y, elev)
    elif dt == "POLYLINE":
        for v in entity.vertices:
            loc = v.dxf.location
            _append_point(out, loc.x, loc.y, getattr(loc, "z", 0) or 0)
    elif dt == "MESH":
        for v in entity.vertices:
            out.append([float(v[0]), float(v[1]), float(v[2]) if len(v) > 2 else 0.0])
    elif dt in {"CIRCLE", "ARC"}:
        c = entity.dxf.center
        r = float(entity.dxf.radius)
        start = float(getattr(entity.dxf, "start_angle", 0) or 0)
        end = float(getattr(entity.dxf, "end_angle", 360) or 360)
        if dt == "CIRCLE":
            start, end = 0.0, 360.0
        cz = float(getattr(c, "z", 0) or 0)
        steps = max(8, int(abs(end - start) / 15))
        for i in range(steps + 1):
            ang = math.radians(start + (end - start) * i / steps)
            _append_point(out, c.x + r * math.cos(ang), c.y + r * math.sin(ang), cz)
    elif dt == "ELLIPSE":
        c = entity.dxf.center
        cz = float(getattr(c, "z", 0) or 0)
        try:
            pts = entity.construction_tool().approximate(16)
            for p in pts:
                _append_point(out, p.x, p.y, getattr(p, "z", cz) or cz)
        except Exception:
            _append_point(out, c.x, c.y, cz)
    elif dt == "SPLINE":
        try:
            for p in entity.control_points:
                _append_point(out, p[0], p[1], p[2] if len(p) > 2 else 0.0)
        except Exception:
            pass
        try:
            for p in entity.fit_points:
                _append_point(out, p[0], p[1], p[2] if len(p) > 2 else 0.0)
        except Exception:
            pass
    elif dt == "INSERT":
        try:
            for ve in entity.virtual_entities():
                out.extend(_dxf_entity_points(ve))
        except Exception:
            pass
    elif dt == "HATCH":
        try:
            for path in entity.paths:
                for edge in path.edges:
                    if hasattr(edge, "start"):
                        _append_point(out, edge.start[0], edge.start[1], edge.start[2] if len(edge.start) > 2 else 0)
                    if hasattr(edge, "end"):
                        _append_point(out, edge.end[0], edge.end[1], edge.end[2] if len(edge.end) > 2 else 0)
        except Exception:
            pass
    return out


def _doc_to_pointcloud(doc, source_name: str):
    points: list[list[float]] = []
    for entity in doc.modelspace():
        points.extend(_dxf_entity_points(entity))

    if not points:
        raise ValueError(f"Không có geometry trong {source_name}")

    verts = np.asarray(points, dtype=np.float64)
    return _mesh_to_pointcloud(verts)


def load_dxf_point_cloud(path: Path):
    import ezdxf

    try:
        doc = ezdxf.readfile(str(path))
    except ezdxf.DXFStructureError as exc:
        raise ValueError(f"DXF không hợp lệ: {path.name}") from exc

    return _doc_to_pointcloud(doc, path.name)


def load_dwg_point_cloud(path: Path):
    """Load DWG via ODA File Converter (ezdxf odafc) when installed."""
    from oda_config import configure_odafc, dwg_import_hint, find_oda_executable

    if not configure_odafc():
        oda = find_oda_executable()
        if oda is None:
            raise ValueError(
                f"Không đọc được DWG: {path.name}.\n\n"
                f"Chưa cài ODA File Converter trên máy Windows.\n\n{dwg_import_hint()}"
            )
        raise ValueError(
            f"Không cấu hình được ODA File Converter tại: {oda}\n\n{dwg_import_hint()}"
        )

    try:
        from ezdxf.addons import odafc
    except ImportError as exc:
        raise ValueError(f"Thiếu ezdxf odafc addon.\n\n{dwg_import_hint()}") from exc

    try:
        doc = odafc.readfile(str(path), audit=True)
    except odafc.ODAFCNotInstalledError as exc:
        raise ValueError(
            f"ODA File Converter chưa sẵn sàng.\n\n{dwg_import_hint()}"
        ) from exc
    except odafc.UnsupportedFileFormat as exc:
        raise ValueError(f"Định dạng DWG không hỗ trợ: {path.name}") from exc
    except odafc.UnsupportedVersion as exc:
        raise ValueError(
            f"Phiên bản DWG quá cũ hoặc không hỗ trợ: {path.name}. "
            "Thử mở bằng AutoCAD và SAVEAS DXF R2018."
        ) from exc
    except odafc.UnknownODAFCError as exc:
        raise ValueError(
            f"ODA không chuyển được {path.name} sang DXF.\n"
            "File có thể bị hỏng hoặc mã hóa. Thử SAVEAS DXF trong AutoCAD.\n\n"
            f"{dwg_import_hint()}"
        ) from exc
    except Exception as exc:
        msg = str(exc).strip()
        raise ValueError(
            f"Không đọc được DWG: {path.name}.\n"
            f"Chi tiết: {msg or type(exc).__name__}\n\n{dwg_import_hint()}"
        ) from exc

    return _doc_to_pointcloud(doc, path.name)
