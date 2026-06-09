"""LandXML / terrain XML point cloud import."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np


def _local_tag(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _parse_xyz_text(text: str) -> list[list[float]]:
    rows: list[list[float]] = []
    parts = re.findall(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?", text)
    for i in range(0, len(parts) - 2, 3):
        try:
            rows.append([float(parts[i]), float(parts[i + 1]), float(parts[i + 2])])
        except ValueError:
            continue
    return rows


def _collect_element_points(elem: ET.Element, acc: list[list[float]]) -> None:
    tag = _local_tag(elem.tag).lower()
    if tag in {"p", "point"}:
        if elem.text:
            acc.extend(_parse_xyz_text(elem.text))
        x = elem.get("x") or elem.get("east") or elem.get("e")
        y = elem.get("y") or elem.get("north") or elem.get("n")
        z = elem.get("z") or elem.get("elev") or elem.get("height") or elem.get("h") or "0"
        if x and y:
            try:
                acc.append([float(x), float(y), float(z)])
            except ValueError:
                pass
    elif tag in {"coord", "coordinate"}:
        xs = elem.findtext(".//{*}X") or elem.findtext(".//{*}East") or elem.findtext("X")
        ys = elem.findtext(".//{*}Y") or elem.findtext(".//{*}North") or elem.findtext("Y")
        zs = elem.findtext(".//{*}Z") or elem.findtext(".//{*}Elev") or elem.findtext("Z") or "0"
        if xs and ys:
            try:
                acc.append([float(xs), float(ys), float(zs)])
            except ValueError:
                pass
    elif tag in {"pntlist3d", "pntlist2d"} and elem.text:
        acc.extend(_parse_xyz_text(elem.text))

    for child in elem:
        _collect_element_points(child, acc)


def load_landxml_point_cloud(path: Path):
    """Parse LandXML or generic survey XML into Open3D point cloud."""
    import open3d as o3d

    tree = ET.parse(path)
    root = tree.getroot()
    points: list[list[float]] = []
    _collect_element_points(root, points)

    if not points:
        raise ValueError(f"Không tìm thấy điểm trong XML: {path.name}")

    pts = np.asarray(points, dtype=np.float64)
    if pts.shape[1] == 2:
        pts = np.column_stack([pts, np.zeros(len(pts))])

    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(pts[:, :3])
    return pcd
