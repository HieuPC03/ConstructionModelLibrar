"""FBX, DXF, DWG → point cloud loaders (centerline geometry, no lineweight)."""

from __future__ import annotations

import math
import re
from pathlib import Path

import numpy as np

# Centerline sampling step (meters/drawing units) — ignores CAD lineweight / polyline width.
_SAMPLE_STEP = 0.1

# Entity types where ezdxf path flattening may trace width outlines instead of centerlines.
_WIDTH_SENSITIVE = frozenset({"LWPOLYLINE", "POLYLINE", "LINE", "POINT", "MLINE"})


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


def _append_vec3(out: list[list[float]], v) -> None:
    if v is None:
        return
    if hasattr(v, "x"):
        _append_point(out, v.x, v.y, getattr(v, "z", 0) or 0)
    elif isinstance(v, (list, tuple)) and len(v) >= 2:
        _append_point(out, v[0], v[1], v[2] if len(v) > 2 else 0.0)


def _vec3_tuple(v) -> tuple[float, float, float]:
    if hasattr(v, "x"):
        return (float(v.x), float(v.y), float(getattr(v, "z", 0) or 0))
    if isinstance(v, (list, tuple)) and len(v) >= 2:
        return (float(v[0]), float(v[1]), float(v[2]) if len(v) > 2 else 0.0)
    return (0.0, 0.0, 0.0)


def _sample_segment(
    p0: tuple[float, float, float],
    p1: tuple[float, float, float],
    step: float = _SAMPLE_STEP,
) -> list[list[float]]:
    """Centerline samples along a segment (no thickness)."""
    dx, dy, dz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
    length = math.sqrt(dx * dx + dy * dy + dz * dz)
    if length < 1e-9:
        return [[p0[0], p0[1], p0[2]]]
    n = max(1, int(math.ceil(length / step)))
    out: list[list[float]] = []
    for i in range(n + 1):
        t = i / n
        out.append([p0[0] + dx * t, p0[1] + dy * t, p0[2] + dz * t])
    return out


def _path_centerline_points(entity, distance: float = _SAMPLE_STEP) -> list[list[float]]:
    """Flatten curves via ezdxf path — skip width-sensitive types."""
    dt = entity.dxftype()
    if dt in _WIDTH_SENSITIVE:
        return []
    try:
        from ezdxf import path

        p = path.make_path(entity)
        return [[float(v.x), float(v.y), float(v.z)] for v in p.flattening(distance)]
    except Exception:
        return []


def _mesh_entity_points(entity) -> list[list[float]]:
    out: list[list[float]] = []
    dt = entity.dxftype()
    if dt == "MESH":
        try:
            for v in entity.vertices:
                out.append([float(v[0]), float(v[1]), float(v[2] if len(v) > 2 else 0.0)])
        except Exception:
            pass
        try:
            for face in entity.faces:
                for idx in face:
                    v = entity.vertices[idx]
                    out.append([float(v[0]), float(v[1]), float(v[2] if len(v) > 2 else 0.0)])
        except Exception:
            pass
    elif dt == "POLYFACE":
        try:
            for v in entity.vertices:
                if hasattr(v.dxf, "location"):
                    _append_vec3(out, v.dxf.location)
        except Exception:
            pass
    elif dt in {"3DSOLID", "BODY", "REGION", "SURFACE"}:
        try:
            from ezdxf import mesh as ezmesh

            for m in ezmesh.from_3dsolid(entity):
                for v in m.vertices:
                    out.append([float(v[0]), float(v[1]), float(v[2])])
        except Exception:
            pass
    return out


def _scrape_dxf_locations(entity) -> list[list[float]]:
    """Collect any Vec3-like DXF attributes from unknown entity types."""
    out: list[list[float]] = []
    if not hasattr(entity, "dxf"):
        return out
    skip = {
        "extrusion",
        "text_style",
        "dimstyle",
        "layer",
        "color",
        "linetype",
        "lineweight",
        "ltscale",
        "true_color",
        "color_name",
        "transparency",
        "thickness",
        "width",
        "const_width",
        "start_width",
        "end_width",
    }
    try:
        attrs = entity.dxf.all_existing_dxf_attribs()
    except Exception:
        attrs = []
    for key in attrs:
        if key in skip or key.endswith("_width"):
            continue
        try:
            val = getattr(entity.dxf, key)
        except Exception:
            continue
        if hasattr(val, "x") and hasattr(val, "y"):
            _append_vec3(out, val)
        elif isinstance(val, (list, tuple)) and len(val) >= 2:
            try:
                nums = [float(v) for v in val]
                if len(nums) >= 3:
                    _append_point(out, nums[0], nums[1], nums[2])
                elif len(nums) >= 2:
                    _append_point(out, nums[0], nums[1], 0.0)
            except (TypeError, ValueError):
                pass
    return out


def _expand_virtual(entity) -> list[list[float]]:
    out: list[list[float]] = []
    for fn_name in ("virtual_entities", "explode"):
        fn = getattr(entity, fn_name, None)
        if not callable(fn):
            continue
        try:
            for child in fn():
                out.extend(_dxf_entity_points(child))
        except Exception:
            pass
        if out:
            return out
    return out


def _dxf_entity_points(entity) -> list[list[float]]:
    dt = entity.dxftype()
    out: list[list[float]] = []

    if dt == "INSERT":
        return _expand_virtual(entity)

    if dt in {"MLINE", "ACAD_PROXY_ENTITY"}:
        pts = _expand_virtual(entity)
        if pts:
            return pts

    mesh_pts = _mesh_entity_points(entity)
    if mesh_pts:
        return mesh_pts

    if dt == "POINT":
        _append_vec3(out, entity.dxf.location)

    elif dt == "LINE":
        p0 = _vec3_tuple(entity.dxf.start)
        p1 = _vec3_tuple(entity.dxf.end)
        out.extend(_sample_segment(p0, p1))

    elif dt in {"XLINE", "RAY"}:
        base = _vec3_tuple(entity.dxf.start)
        try:
            d = entity.dxf.unit_vector
            dx, dy, dz = float(d.x), float(d.y), float(getattr(d, "z", 0) or 0)
            span = 50.0
            out.extend(_sample_segment(base, (base[0] + dx * span, base[1] + dy * span, base[2] + dz * span)))
            if dt == "XLINE":
                out.extend(_sample_segment(base, (base[0] - dx * span, base[1] - dy * span, base[2] - dz * span)))
        except Exception:
            out.append(list(base))

    elif dt == "LWPOLYLINE":
        elev = float(getattr(entity.dxf, "elevation", 0) or 0)
        try:
            for p in entity.flattening(_SAMPLE_STEP):
                if hasattr(p, "x"):
                    _append_point(out, p.x, p.y, getattr(p, "z", elev) or elev)
                else:
                    _append_point(out, p[0], p[1], p[2] if len(p) > 2 else elev)
        except Exception:
            pts2d = list(entity.get_points("xy"))
            for i, (x, y, *_) in enumerate(pts2d):
                _append_point(out, x, y, elev)
                if i > 0:
                    p0 = (pts2d[i - 1][0], pts2d[i - 1][1], elev)
                    p1 = (x, y, elev)
                    out.extend(_sample_segment(p0, p1)[1:])

    elif dt == "POLYLINE":
        verts = []
        for v in entity.vertices:
            verts.append(_vec3_tuple(v.dxf.location))
        for i, p in enumerate(verts):
            out.append(list(p))
            if i > 0:
                out.extend(_sample_segment(verts[i - 1], p)[1:])

    elif dt in {"CIRCLE", "ARC"}:
        c = entity.dxf.center
        r = float(entity.dxf.radius)
        start = float(getattr(entity.dxf, "start_angle", 0) or 0)
        end = float(getattr(entity.dxf, "end_angle", 360) or 360)
        if dt == "CIRCLE":
            start, end = 0.0, 360.0
        cz = float(getattr(c, "z", 0) or 0)
        arc_len = abs(end - start) * math.pi / 180.0 * r
        steps = max(12, int(math.ceil(arc_len / _SAMPLE_STEP)))
        for i in range(steps + 1):
            ang = math.radians(start + (end - start) * i / steps)
            _append_point(out, c.x + r * math.cos(ang), c.y + r * math.sin(ang), cz)

    elif dt == "ELLIPSE":
        c = entity.dxf.center
        cz = float(getattr(c, "z", 0) or 0)
        try:
            for p in entity.construction_tool().approximate(48):
                _append_point(out, p.x, p.y, getattr(p, "z", cz) or cz)
        except Exception:
            _append_vec3(out, c)

    elif dt == "SPLINE":
        try:
            for p in entity.flattening(_SAMPLE_STEP):
                if hasattr(p, "x"):
                    _append_point(out, p.x, p.y, getattr(p, "z", 0) or 0)
                else:
                    _append_point(out, p[0], p[1], p[2] if len(p) > 2 else 0.0)
        except Exception:
            for p in getattr(entity, "fit_points", []) or []:
                _append_point(out, p[0], p[1], p[2] if len(p) > 2 else 0.0)
            for p in getattr(entity, "control_points", []) or []:
                _append_point(out, p[0], p[1], p[2] if len(p) > 2 else 0.0)

    elif dt == "3DFACE":
        face_pts = []
        for attr in ("vtx0", "vtx1", "vtx2", "vtx3"):
            if hasattr(entity.dxf, attr):
                face_pts.append(_vec3_tuple(getattr(entity.dxf, attr)))
        for i, p in enumerate(face_pts):
            out.append(list(p))
            if i > 0:
                out.extend(_sample_segment(face_pts[i - 1], p)[1:])
        if len(face_pts) >= 3:
            out.extend(_sample_segment(face_pts[-1], face_pts[0])[1:])

    elif dt in {"SOLID", "TRACE"}:
        for attr in ("vtx0", "vtx1", "vtx2", "vtx3"):
            if hasattr(entity.dxf, attr):
                _append_vec3(out, getattr(entity.dxf, attr))

    elif dt in {"TEXT", "MTEXT", "ATTRIB", "ATTDEF"}:
        if hasattr(entity.dxf, "insert"):
            _append_vec3(out, entity.dxf.insert)
        elif hasattr(entity.dxf, "location"):
            _append_vec3(out, entity.dxf.location)

    elif dt == "DIMENSION":
        for attr in (
            "defpoint",
            "defpoint2",
            "defpoint3",
            "defpoint4",
            "text_midpoint",
            "insert",
        ):
            if hasattr(entity.dxf, attr):
                _append_vec3(out, getattr(entity.dxf, attr))

    elif dt in {"LEADER", "MLEADER"}:
        verts = []
        try:
            for p in entity.vertices:
                verts.append(_vec3_tuple(p))
        except Exception:
            pass
        for i, p in enumerate(verts):
            out.append(list(p))
            if i > 0:
                out.extend(_sample_segment(verts[i - 1], p)[1:])
        if hasattr(entity.dxf, "insert"):
            _append_vec3(out, entity.dxf.insert)

    elif dt == "HATCH":
        try:
            for path_obj in entity.paths:
                for edge in path_obj.edges:
                    edge_pts: list[tuple[float, float, float]] = []
                    if hasattr(edge, "start"):
                        edge_pts.append(
                            (
                                float(edge.start[0]),
                                float(edge.start[1]),
                                float(edge.start[2]) if len(edge.start) > 2 else 0.0,
                            )
                        )
                    try:
                        for p in edge.flattening(_SAMPLE_STEP):
                            edge_pts.append(
                                (
                                    float(p[0]),
                                    float(p[1]),
                                    float(p[2]) if len(p) > 2 else 0.0,
                                )
                            )
                    except Exception:
                        if hasattr(edge, "end"):
                            edge_pts.append(
                                (
                                    float(edge.end[0]),
                                    float(edge.end[1]),
                                    float(edge.end[2]) if len(edge.end) > 2 else 0.0,
                                )
                            )
                    for i, p in enumerate(edge_pts):
                        out.append(list(p))
                        if i > 0:
                            out.extend(_sample_segment(edge_pts[i - 1], p)[1:])
        except Exception:
            pass

    elif dt == "IMAGE":
        if hasattr(entity.dxf, "insert"):
            _append_vec3(out, entity.dxf.insert)

    elif dt == "WIPEOUT":
        pts = []
        try:
            for p in entity.get_points():
                pts.append((float(p[0]), float(p[1]), float(p[2]) if len(p) > 2 else 0.0))
        except Exception:
            pass
        for i, p in enumerate(pts):
            out.append(list(p))
            if i > 0:
                out.extend(_sample_segment(pts[i - 1], p)[1:])

    elif dt == "VIEWPORT":
        if hasattr(entity.dxf, "center"):
            _append_vec3(out, entity.dxf.center)

    elif dt == "VERTEX":
        _append_vec3(out, entity.dxf.location)

    elif dt in {"SHAPE", "UNDERLAY", "TOLERANCE", "GEOPOSITIONMARKER"}:
        if hasattr(entity.dxf, "insert"):
            _append_vec3(out, entity.dxf.insert)

    elif dt == "LIGHT":
        if hasattr(entity.dxf, "location"):
            _append_vec3(out, entity.dxf.location)

    elif dt == "HELIX":
        _append_vec3(out, entity.dxf.center)

    elif dt == "MPOLYGON":
        try:
            for p in entity.flattening(_SAMPLE_STEP):
                if hasattr(p, "x"):
                    _append_point(out, p.x, p.y, getattr(p, "z", 0) or 0)
                else:
                    _append_point(out, p[0], p[1], p[2] if len(p) > 2 else 0.0)
        except Exception:
            pass

    elif dt in {"TABLE", "ACAD_TABLE"}:
        if hasattr(entity.dxf, "insert"):
            _append_vec3(out, entity.dxf.insert)

    elif dt == "OLE2FRAME":
        if hasattr(entity.dxf, "location"):
            _append_vec3(out, entity.dxf.location)

    # Fallbacks for anything not handled above
    if not out:
        out.extend(_path_centerline_points(entity))
    if not out:
        out.extend(_expand_virtual(entity))
    if not out:
        out.extend(_scrape_dxf_locations(entity))

    return out


def _iter_layout_entities(doc):
    """Yield entities from model space and paper layouts (INSERT expands blocks)."""
    yield from doc.modelspace()
    for layout in doc.layouts:
        if layout.name.upper() == "MODEL":
            continue
        try:
            yield from layout
        except Exception:
            pass


def _doc_to_pointcloud(doc, source_name: str):
    points: list[list[float]] = []

    for entity in _iter_layout_entities(doc):
        points.extend(_dxf_entity_points(entity))

    if not points:
        for block in doc.blocks:
            if block.name.startswith("*"):
                continue
            for entity in block:
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
                f"Chưa tìm thấy ODA File Converter.\n\n{dwg_import_hint()}"
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
