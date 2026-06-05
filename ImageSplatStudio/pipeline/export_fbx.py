#!/usr/bin/env python3
"""Export Gaussian splat or point cloud to FBX (ASCII mesh via Poisson reconstruction)."""

from __future__ import annotations

import argparse
import struct
import sys
from pathlib import Path

_ROOT = str(Path(__file__).resolve().parent)
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)


def read_splat_positions(splat_path: Path, max_points: int = 80_000) -> "np.ndarray":
    import numpy as np

    data = splat_path.read_bytes()
    row = 32
    n = len(data) // row
    if n == 0:
        raise ValueError("File splat rỗng")
    step = max(1, n // max_points)
    pts = []
    for i in range(0, n, step):
        off = i * row
        x, y, z = struct.unpack_from("<fff", data, off)
        pts.append((x, y, z))
    return np.asarray(pts, dtype=np.float64)


def poisson_mesh_from_points(points):
    import open3d as o3d
    import numpy as np

    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(points)
    if len(points) > 100_000:
        pcd = pcd.voxel_down_sample(voxel_size=float(np.max(pcd.get_max_bound() - pcd.get_min_bound())) / 200.0)
    pcd.estimate_normals(search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.1, max_nn=30))
    mesh, _ = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(pcd, depth=8)
    mesh.remove_degenerate_triangles()
    mesh.remove_duplicated_triangles()
    mesh.remove_non_manifold_edges()
    return mesh


def write_fbx_ascii(path: Path, vertices, faces) -> None:
    """Write minimal FBX 7.4 ASCII with mesh geometry."""
    lines = [
        "; FBX 7.4.0 project file",
        "FBXHeaderExtension:  {",
        "    FBXHeaderVersion: 1003",
        "    FBXVersion: 7400",
        "}",
        "Definitions:  {",
        "    Version: 100",
        "    Count: 1",
        "    ObjectType: \"Geometry\" {",
        "        Count: 1",
        "    }",
        "}",
        "Objects:  {",
        "    Geometry: 1, \"Geometry::\", \"Mesh\" {",
        f"        Vertices: *{len(vertices) * 3} {{",
        "            a: " + ",".join(f"{v:.6f}" for v in vertices.flatten()) + "",
        "        }",
        f"        PolygonVertexIndex: *{len(faces) * 3} {{",
    ]
    idx_parts = []
    for tri in faces:
        idx_parts.extend([str(int(tri[0])), str(int(tri[1])), str(-int(tri[2]) - 1)])
    lines.append("            a: " + ",".join(idx_parts))
    lines.extend([
        "        }",
        "    }",
        "}",
        "Connections:  {",
        "}",
        "",
    ])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def export_fbx_from_splat(splat_path: Path, fbx_path: Path) -> None:
    import numpy as np

    points = read_splat_positions(splat_path)
    mesh = poisson_mesh_from_points(points)
    verts = np.asarray(mesh.vertices, dtype=np.float64)
    faces = np.asarray(mesh.triangles, dtype=np.int64)
    if len(verts) == 0 or len(faces) == 0:
        raise ValueError("Không tạo được mesh cho FBX")
    write_fbx_ascii(fbx_path, verts, faces)
    print(f"Exported FBX: {fbx_path} ({len(verts)} verts, {len(faces)} faces)")


def main() -> int:
    parser = argparse.ArgumentParser(description="Export .splat → .fbx")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        export_fbx_from_splat(args.input, args.output)
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
