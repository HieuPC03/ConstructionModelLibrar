"""Point cloud editor session operations."""

from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path

import numpy as np

from app.config import settings
from app.services.crs_presets import crs_name_for_epsg
from app.services.preview_cache import get_session, update_session_total


def _pipeline_path() -> str:
    pipeline_dir = settings.app_root / "pipeline"
    pipeline_str = str(pipeline_dir)
    if pipeline_str not in sys.path:
        sys.path.insert(0, pipeline_str)
    return pipeline_str


def _session_dir(session_id: str) -> Path:
    session = get_session(session_id)
    if session is None:
        raise ValueError("Phiên preview đã hết hạn — tải lại file.")
    return session.points_path.parent


def _state_path(session_id: str) -> Path:
    return _session_dir(session_id) / "state.json"


def load_state(session_id: str) -> dict:
    _pipeline_path()
    from pointcloud_editor_ops import load_json

    return load_json(_state_path(session_id))


def save_state(session_id: str, state: dict) -> None:
    _pipeline_path()
    from pointcloud_editor_ops import save_json

    save_json(_state_path(session_id), state)


def load_points_colors(session_id: str) -> tuple[np.ndarray, np.ndarray | None]:
    session = get_session(session_id)
    if session is None:
        raise ValueError("Phiên preview đã hết hạn — tải lại file.")
    pts = np.load(session.points_path)
    cols = np.load(session.colors_path) if session.colors_path else None
    return pts, cols


def load_classifications(session_id: str) -> np.ndarray:
    session = get_session(session_id)
    if session is None:
        raise ValueError("Phiên preview đã hết hạn — tải lại file.")
    path = session.points_path.parent / "classifications.npy"
    pts = np.load(session.points_path)
    if path.exists():
        cls = np.load(path)
        if len(cls) == len(pts):
            return cls
    return np.zeros(len(pts), dtype=np.uint8)


def save_points_colors(
    session_id: str,
    points: np.ndarray,
    colors: np.ndarray | None,
    classifications: np.ndarray | None = None,
) -> None:
    session = get_session(session_id)
    if session is None:
        raise ValueError("Phiên preview đã hết hạn — tải lại file.")
    np.save(session.points_path, np.asarray(points, dtype=np.float32))
    if colors is not None:
        if session.colors_path is None:
            session.colors_path = session.points_path.parent / "colors.npy"
        np.save(session.colors_path, np.asarray(colors, dtype=np.float32))
    if classifications is not None:
        cls_path = session.points_path.parent / "classifications.npy"
        np.save(cls_path, np.asarray(classifications, dtype=np.uint8))
        session.classifications_path = cls_path
    update_session_total(session_id, len(points))


def get_visible_points(session_id: str) -> tuple[np.ndarray, np.ndarray | None, dict]:
    _pipeline_path()
    from pointcloud_editor_ops import apply_swap_xy, compute_visibility_mask

    state = load_state(session_id)
    meta = state.get("norm_meta", {})
    pts, cols = load_points_colors(session_id)
    if state.get("swap_xy"):
        pts = apply_swap_xy(pts, meta)
    mask = compute_visibility_mask(len(pts), state, pts)
    visible_pts = pts[mask]
    visible_cols = cols[mask] if cols is not None and len(cols) == len(pts) else None
    return visible_pts, visible_cols, state


def _classification_summary(session_id: str) -> dict:
    _pipeline_path()
    from pointcloud_lasso import classification_counts

    cls = load_classifications(session_id)
    counts = classification_counts(cls)
    hidden = load_state(session_id).get("hidden_class_ids", [])
    layers = []
    for cid_str, count in sorted(counts.items(), key=lambda x: int(x[0])):
        cid = int(cid_str)
        layers.append(
            {
                "id": cid,
                "count": count,
                "visible": cid not in hidden,
            }
        )
    return {
        "enabled": True,
        "counts": counts,
        "layers": layers,
        "hidden_class_ids": hidden,
    }


def get_properties(session_id: str) -> dict:
    state = load_state(session_id)
    pts, _ = load_points_colors(session_id)
    bbox = {
        "min": [float(x) for x in np.min(pts, axis=0)],
        "max": [float(x) for x in np.max(pts, axis=0)],
    }
    return {
        "session_id": session_id,
        "total_points": int(len(pts)),
        "files": state.get("files", []),
        "swap_xy": bool(state.get("swap_xy", False)),
        "hidden_regions": state.get("hidden_regions", []),
        "grid": state.get("grid", {"enabled": False, "cell_size": 0.2, "region": None, "method": "idw", "has_data": False}),
        "mesh": state.get("mesh"),
        "breaklines": state.get("breaklines", []),
        "coord_points": state.get("coord_points", []),
        "measurements": state.get("measurements", []),
        "classifications": _classification_summary(session_id),
        "can_undo": len(state.get("undo_stack", [])) > 0,
        "can_redo": len(state.get("redo_stack", [])) > 0,
        "bounds": bbox,
        "norm_meta": state.get("norm_meta", {}),
        "crs": state.get("crs", {"epsg": 6668, "name": "JGD2011"}),
        "basemap": state.get("basemap", {"enabled": False, "mode": "aerial"}),
        "view": state.get(
            "view",
            {"show_axes": True, "fov": 50, "color_mode": "rgb", "show_grid_surface": False},
        ),
        "contours": state.get("contours"),
        "volumes": state.get("volumes", []),
        "last_cross_section": state.get("last_cross_section"),
        "deviation_heatmap": state.get("deviation_heatmap"),
        "viewpoints": state.get("viewpoints", []),
        "has_splat": state.get("has_splat", False),
        "survey_imports": state.get("survey_imports", []),
    }


def toggle_swap_xy(session_id: str) -> dict:
    state = load_state(session_id)
    state["swap_xy"] = not bool(state.get("swap_xy", False))
    save_state(session_id, state)
    return get_properties(session_id)


def set_file_visibility(session_id: str, file_index: int, visible: bool) -> dict:
    state = load_state(session_id)
    files = state.get("files", [])
    if file_index < 0 or file_index >= len(files):
        raise ValueError("File index không hợp lệ.")
    files[file_index]["visible"] = visible
    state["files"] = files
    save_state(session_id, state)
    return get_properties(session_id)


def add_hidden_region(session_id: str, min_pt: list[float], max_pt: list[float]) -> dict:
    state = load_state(session_id)
    regions = state.get("hidden_regions", [])
    regions.append(
        {
            "id": uuid.uuid4().hex[:8],
            "min": min_pt,
            "max": max_pt,
            "hidden": True,
        }
    )
    state["hidden_regions"] = regions
    save_state(session_id, state)
    return get_properties(session_id)


def clear_hidden_regions(session_id: str) -> dict:
    state = load_state(session_id)
    state["hidden_regions"] = []
    save_state(session_id, state)
    return get_properties(session_id)


def show_all(session_id: str) -> dict:
    state = load_state(session_id)
    for f in state.get("files", []):
        f["visible"] = True
    state["hidden_regions"] = []
    save_state(session_id, state)
    return get_properties(session_id)


def clean_outliers(session_id: str) -> dict:
    _pipeline_path()
    from pointcloud_editor_ops import remove_statistical_outliers

    pts, cols = load_points_colors(session_id)
    new_pts, new_cols, _ = remove_statistical_outliers(pts, cols)
    save_points_colors(session_id, new_pts, new_cols)
    state = load_state(session_id)
    state["files"] = [
        {
            "name": "cleaned_cloud",
            "format": "edited",
            "point_count": int(len(new_pts)),
            "size_bytes": 0,
            "start_index": 0,
            "visible": True,
        }
    ]
    save_state(session_id, state)
    return get_properties(session_id)


def split_session(session_id: str, axis: int, value: float) -> dict:
    _pipeline_path()
    from pointcloud_editor_ops import split_by_axis

    if axis not in (0, 1, 2):
        raise ValueError("axis phải là 0, 1 hoặc 2.")
    pts, cols = load_points_colors(session_id)
    (left_pts, left_cols), (right_pts, right_cols) = split_by_axis(pts, cols, axis, value)
    save_points_colors(session_id, left_pts, left_cols)
    state = load_state(session_id)
    state["files"] = [
        {
            "name": f"split_left_{axis}",
            "format": "split",
            "point_count": int(len(left_pts)),
            "size_bytes": 0,
            "start_index": 0,
            "visible": True,
        }
    ]
    split_dir = _session_dir(session_id) / "splits"
    split_dir.mkdir(exist_ok=True)
    split_id = uuid.uuid4().hex[:8]
    np.save(split_dir / f"{split_id}_right.npy", right_pts)
    if right_cols is not None:
        np.save(split_dir / f"{split_id}_right_colors.npy", right_cols)
    state["last_split"] = {
        "split_id": split_id,
        "right_points": int(len(right_pts)),
        "axis": axis,
        "value": value,
    }
    save_state(session_id, state)
    return get_properties(session_id)


def configure_grid(
    session_id: str,
    *,
    enabled: bool,
    cell_size: float,
    region_min: list[float] | None = None,
    region_max: list[float] | None = None,
    create_data: bool = False,
    clear_region: bool = False,
) -> dict:
    _pipeline_path()
    from pointcloud_editor_ops import build_plan_grid_lines, create_idw_grid, pack_grid_lines

    state = load_state(session_id)
    cell = max(float(cell_size), 0.01)
    grid = state.get("grid", {"enabled": False, "cell_size": 0.2, "region": None, "method": "idw", "has_data": False})
    grid["enabled"] = bool(enabled)
    grid["cell_size"] = cell
    grid["method"] = grid.get("method", "idw")

    if clear_region:
        grid["region"] = None
    elif region_min is not None and region_max is not None:
        grid["region"] = {"min": region_min, "max": region_max}

    pts, _ = load_points_colors(session_id)
    if grid.get("region"):
        mn = np.asarray(grid["region"]["min"], dtype=np.float64)
        mx = np.asarray(grid["region"]["max"], dtype=np.float64)
    else:
        mn = np.min(pts, axis=0)
        mx = np.max(pts, axis=0)

    lines = build_plan_grid_lines(mn, mx, cell)
    grid_path = _session_dir(session_id) / "grid.bin"
    grid_path.write_bytes(pack_grid_lines(lines))

    if create_data and enabled:
        visible_pts, _, _ = get_visible_points(session_id)
        idw = create_idw_grid(visible_pts, mn, mx, cell)
        grid_data_path = _session_dir(session_id) / "grid_data.json"
        grid_data_path.write_text(json.dumps(idw, ensure_ascii=False), encoding="utf-8")
        grid["has_data"] = True
        grid["data_size"] = idw["size"]

    state["grid"] = grid
    save_state(session_id, state)
    return get_properties(session_id)


def get_grid_binary(session_id: str) -> bytes | None:
    state = load_state(session_id)
    if not state.get("grid", {}).get("enabled"):
        return None
    grid_path = _session_dir(session_id) / "grid.bin"
    if not grid_path.exists():
        return None
    return grid_path.read_bytes()


def create_mesh(session_id: str, method: str = "idw", cell_size: float | None = None) -> dict:
    _pipeline_path()
    from pointcloud_editor_ops import mesh_from_points

    visible_pts, visible_cols, state = get_visible_points(session_id)
    if len(visible_pts) < 4:
        raise ValueError("Cần ít nhất 4 điểm hiển thị để tạo mesh địa hình.")

    grid = state.get("grid", {})
    cell = max(float(cell_size or grid.get("cell_size", 0.2)), 0.01)

    if grid.get("region"):
        mn = np.asarray(grid["region"]["min"], dtype=np.float64)
        mx = np.asarray(grid["region"]["max"], dtype=np.float64)
    else:
        mn = np.min(visible_pts, axis=0)
        mx = np.max(visible_pts, axis=0)

    mesh_path = _session_dir(session_id) / "mesh.obj"
    info = mesh_from_points(
        visible_pts,
        visible_cols,
        mesh_path,
        method=method,
        cell_size=cell,
        bbox_min=mn,
        bbox_max=mx,
    )
    state["mesh"] = {"path": str(mesh_path.name), **info}
    save_state(session_id, state)
    return get_properties(session_id)


def export_session(session_id: str, fmt: str) -> Path:
    _pipeline_path()
    from pointcloud_export import denormalize_points, write_las_file, write_xyz_txt

    visible_pts, visible_cols, state = get_visible_points(session_id)
    if len(visible_pts) == 0:
        raise ValueError("Không có điểm để xuất.")
    meta = state.get("norm_meta", {})
    world_pts = denormalize_points(visible_pts, meta, swap_xy=False)
    export_dir = _session_dir(session_id) / "exports"
    export_dir.mkdir(exist_ok=True)
    if fmt == "las":
        out = export_dir / "export.las"
        write_las_file(out, world_pts, visible_cols)
    elif fmt == "txt":
        out = export_dir / "export.txt"
        write_xyz_txt(out, world_pts, visible_cols)
    else:
        raise ValueError(f"Định dạng không hỗ trợ: {fmt}")
    return out


def get_mesh_path(session_id: str) -> Path:
    state = load_state(session_id)
    mesh = state.get("mesh")
    if not mesh:
        raise ValueError("Chưa tạo mesh.")
    path = _session_dir(session_id) / mesh.get("path", "mesh.obj")
    if not path.exists():
        raise ValueError("File mesh không tồn tại.")
    return path


def init_session_state(session_id: str, files_info: list[dict], norm_meta: dict) -> None:
    _pipeline_path()
    from pointcloud_editor_ops import default_state, save_json

    save_json(_state_path(session_id), default_state(files=files_info, norm_meta=norm_meta))


def _undo_dir(session_id: str) -> Path:
    d = _session_dir(session_id) / "undo"
    d.mkdir(exist_ok=True)
    return d


def push_undo(session_id: str) -> None:
    """Save snapshot before a mutating edit."""
    import shutil
    import time

    session = get_session(session_id)
    if session is None:
        return
    ts = str(int(time.time() * 1000))
    snap = _undo_dir(session_id) / ts
    snap.mkdir()
    shutil.copy2(session.points_path, snap / "points.npy")
    if session.colors_path and session.colors_path.exists():
        shutil.copy2(session.colors_path, snap / "colors.npy")
    cls_path = session.points_path.parent / "classifications.npy"
    if cls_path.exists():
        shutil.copy2(cls_path, snap / "classifications.npy")
    shutil.copy2(_state_path(session_id), snap / "state.json")
    state = load_state(session_id)
    stack = state.get("undo_stack", [])
    stack.append(ts)
    if len(stack) > 20:
        old = stack.pop(0)
        shutil.rmtree(_undo_dir(session_id) / old, ignore_errors=True)
    state["undo_stack"] = stack
    state["redo_stack"] = []
    save_state(session_id, state)


def _restore_snapshot(session_id: str, snap_id: str) -> None:
    import shutil

    session = get_session(session_id)
    if session is None:
        raise ValueError("Phiên preview đã hết hạn.")
    snap = _undo_dir(session_id) / snap_id
    if not snap.exists():
        raise ValueError("Snapshot không tồn tại.")
    shutil.copy2(snap / "points.npy", session.points_path)
    colors = snap / "colors.npy"
    if colors.exists():
        if session.colors_path is None:
            session.colors_path = session.points_path.parent / "colors.npy"
        shutil.copy2(colors, session.colors_path)
    snap_cls = snap / "classifications.npy"
    if snap_cls.exists():
        shutil.copy2(snap_cls, session.points_path.parent / "classifications.npy")
    shutil.copy2(snap / "state.json", _state_path(session_id))
    pts = np.load(session.points_path)
    update_session_total(session_id, len(pts))


def _save_current_snapshot(session_id: str) -> str:
    import shutil
    import time

    session = get_session(session_id)
    if session is None:
        raise ValueError("Phiên preview đã hết hạn.")
    ts = str(int(time.time() * 1000))
    snap = _undo_dir(session_id) / ts
    snap.mkdir()
    shutil.copy2(session.points_path, snap / "points.npy")
    if session.colors_path and session.colors_path.exists():
        shutil.copy2(session.colors_path, snap / "colors.npy")
    cls_path = session.points_path.parent / "classifications.npy"
    if cls_path.exists():
        shutil.copy2(cls_path, snap / "classifications.npy")
    shutil.copy2(_state_path(session_id), snap / "state.json")
    return ts


def undo_session(session_id: str) -> dict:
    state = load_state(session_id)
    stack = list(state.get("undo_stack", []))
    if not stack:
        raise ValueError("Không có thao tác để hoàn tác.")
    redo_id = _save_current_snapshot(session_id)
    snap_id = stack.pop()
    _restore_snapshot(session_id, snap_id)
    state = load_state(session_id)
    redo = state.get("redo_stack", [])
    redo.append(redo_id)
    state["undo_stack"] = stack
    state["redo_stack"] = redo
    save_state(session_id, state)
    return get_properties(session_id)


def redo_session(session_id: str) -> dict:
    state = load_state(session_id)
    redo = list(state.get("redo_stack", []))
    if not redo:
        raise ValueError("Không có thao tác để làm lại.")
    undo_id = _save_current_snapshot(session_id)
    snap_id = redo.pop()
    _restore_snapshot(session_id, snap_id)
    state = load_state(session_id)
    stack = state.get("undo_stack", [])
    stack.append(undo_id)
    state["undo_stack"] = stack
    state["redo_stack"] = redo
    save_state(session_id, state)
    return get_properties(session_id)


def _sync_edited_files(state: dict, point_count: int) -> dict:
    state["files"] = [
        {
            "name": "edited_cloud",
            "format": "edited",
            "point_count": int(point_count),
            "size_bytes": 0,
            "start_index": 0,
            "visible": True,
        }
    ]
    return state


def _filter_classifications(session_id: str, keep: np.ndarray) -> np.ndarray:
    cls = load_classifications(session_id)
    if len(cls) != len(keep):
        return np.zeros(int(np.sum(keep)), dtype=np.uint8)
    return cls[keep]


def delete_points_at(session_id: str, position: list[float], radius: float = 0.02) -> dict:
    _pipeline_path()
    from pointcloud_mesh_edit import delete_points_near

    push_undo(session_id)
    pts, cols = load_points_colors(session_id)
    c = np.asarray(position, dtype=np.float32)
    dist = np.linalg.norm(pts - c, axis=1)
    keep = dist > float(radius)
    new_pts, new_cols, removed = delete_points_near(pts, cols, position, radius)
    if removed == 0:
        state = load_state(session_id)
        stack = state.get("undo_stack", [])
        if stack:
            stack.pop()
            state["undo_stack"] = stack
            save_state(session_id, state)
        raise ValueError("Không tìm thấy điểm trong vùng chọn.")
    new_cls = _filter_classifications(session_id, keep)
    save_points_colors(session_id, new_pts, new_cols, new_cls)
    state = load_state(session_id)
    _sync_edited_files(state, len(new_pts))
    save_state(session_id, state)
    result = get_properties(session_id)
    result["removed_count"] = removed
    return result


def add_point_at(session_id: str, position: list[float]) -> dict:
    _pipeline_path()
    from pointcloud_mesh_edit import add_point

    push_undo(session_id)
    pts, cols = load_points_colors(session_id)
    new_pts, new_cols = add_point(pts, cols, position)
    cls = load_classifications(session_id)
    new_cls = np.concatenate([cls, np.array([0], dtype=np.uint8)]) if len(cls) == len(pts) else np.zeros(len(new_pts), dtype=np.uint8)
    save_points_colors(session_id, new_pts, new_cols, new_cls)
    state = load_state(session_id)
    _sync_edited_files(state, len(new_pts))
    save_state(session_id, state)
    return get_properties(session_id)


def add_breakline(session_id: str, points: list[list[float]]) -> dict:
    if len(points) < 2:
        raise ValueError("Breakline cần ít nhất 2 điểm.")
    state = load_state(session_id)
    lines = state.get("breaklines", [])
    lines.append({"id": uuid.uuid4().hex[:8], "points": points})
    state["breaklines"] = lines
    save_state(session_id, state)
    return get_properties(session_id)


def mesh_add_vertex(session_id: str, position: list[float]) -> dict:
    _pipeline_path()
    from pointcloud_mesh_edit import add_mesh_vertex

    path = get_mesh_path(session_id)
    info = add_mesh_vertex(path, position)
    state = load_state(session_id)
    if state.get("mesh"):
        state["mesh"]["vertices"] = info["vertices"]
        state["mesh"]["triangles"] = info["triangles"]
    save_state(session_id, state)
    return get_properties(session_id)


def mesh_delete_vertex(session_id: str, vertex_index: int) -> dict:
    _pipeline_path()
    from pointcloud_mesh_edit import delete_mesh_vertex

    path = get_mesh_path(session_id)
    info = delete_mesh_vertex(path, vertex_index)
    state = load_state(session_id)
    if state.get("mesh"):
        state["mesh"]["vertices"] = info["vertices"]
        state["mesh"]["triangles"] = info["triangles"]
    save_state(session_id, state)
    return get_properties(session_id)


def clip_box(session_id: str, min_pt: list[float], max_pt: list[float], mode: str = "inside") -> dict:
    _pipeline_path()
    from pointcloud_filters import delete_points_in_box

    push_undo(session_id)
    pts, cols = load_points_colors(session_id)
    new_pts, new_cols, removed = delete_points_in_box(pts, cols, min_pt, max_pt, mode=mode)
    if removed == 0:
        state = load_state(session_id)
        stack = state.get("undo_stack", [])
        if stack:
            stack.pop()
            state["undo_stack"] = stack
            save_state(session_id, state)
        raise ValueError("Không có điểm trong vùng cắt.")
    keep = np.ones(len(pts), dtype=bool)
    mn = np.minimum(min_pt, max_pt)
    mx = np.maximum(min_pt, max_pt)
    inside = np.all((pts >= mn) & (pts <= mx), axis=1)
    if mode == "outside":
        keep = inside
    else:
        keep = ~inside
    new_cls = _filter_classifications(session_id, keep)
    save_points_colors(session_id, new_pts, new_cols, new_cls)
    state = load_state(session_id)
    _sync_edited_files(state, len(new_pts))
    save_state(session_id, state)
    result = get_properties(session_id)
    result["removed_count"] = removed
    return result


def polygon_delete(session_id: str, polygon: list[list[float]]) -> dict:
    _pipeline_path()
    from pointcloud_filters import delete_points_in_polygon_xy

    push_undo(session_id)
    pts, cols = load_points_colors(session_id)
    poly = np.asarray(polygon, dtype=np.float64)
    xy = pts[:, :2]
    from pointcloud_filters import _points_in_polygon

    inside = _points_in_polygon(xy, poly[:, :2])
    keep = ~inside
    new_pts, new_cols, removed = delete_points_in_polygon_xy(pts, cols, polygon)
    if removed == 0:
        state = load_state(session_id)
        stack = state.get("undo_stack", [])
        if stack:
            stack.pop()
            state["undo_stack"] = stack
            save_state(session_id, state)
        raise ValueError("Không có điểm trong vùng đa giác.")
    new_cls = _filter_classifications(session_id, keep)
    save_points_colors(session_id, new_pts, new_cols, new_cls)
    state = load_state(session_id)
    _sync_edited_files(state, len(new_pts))
    save_state(session_id, state)
    result = get_properties(session_id)
    result["removed_count"] = removed
    return result


def apply_density_filter(session_id: str, radius: float, min_neighbors: int = 5) -> dict:
    _pipeline_path()
    from pointcloud_filters import filter_by_density

    push_undo(session_id)
    pts, cols = load_points_colors(session_id)
    new_pts, new_cols, removed = filter_by_density(pts, cols, radius=radius, min_neighbors=min_neighbors)
    save_points_colors(session_id, new_pts, new_cols)
    state = load_state(session_id)
    _sync_edited_files(state, len(new_pts))
    save_state(session_id, state)
    result = get_properties(session_id)
    result["removed_count"] = removed
    return result


def apply_ground_filter(session_id: str, cell_size: float, max_offset: float) -> dict:
    _pipeline_path()
    from pointcloud_filters import filter_ground_offset

    push_undo(session_id)
    pts, cols = load_points_colors(session_id)
    new_pts, new_cols, removed = filter_ground_offset(pts, cols, cell_size=cell_size, max_offset=max_offset)
    save_points_colors(session_id, new_pts, new_cols)
    state = load_state(session_id)
    _sync_edited_files(state, len(new_pts))
    save_state(session_id, state)
    result = get_properties(session_id)
    result["removed_count"] = removed
    return result


def add_coord_point(session_id: str, position: list[float], label: str = "") -> dict:
    state = load_state(session_id)
    points = state.get("coord_points", [])
    points.append({"id": uuid.uuid4().hex[:8], "position": position, "label": label or f"P{len(points) + 1}"})
    state["coord_points"] = points
    save_state(session_id, state)
    return get_properties(session_id)


def add_measurement(
    session_id: str,
    mtype: str,
    points: list[list[float]],
    value: float,
    unit: str = "m",
) -> dict:
    state = load_state(session_id)
    items = state.get("measurements", [])
    items.append(
        {
            "id": uuid.uuid4().hex[:8],
            "type": mtype,
            "points": points,
            "value": float(value),
            "unit": unit,
        }
    )
    state["measurements"] = items
    save_state(session_id, state)
    return get_properties(session_id)


def delete_breakline(session_id: str, breakline_id: str) -> dict:
    state = load_state(session_id)
    lines = [bl for bl in state.get("breaklines", []) if bl.get("id") != breakline_id]
    state["breaklines"] = lines
    save_state(session_id, state)
    return get_properties(session_id)


def delete_hidden_region(session_id: str, region_id: str) -> dict:
    state = load_state(session_id)
    regions = [r for r in state.get("hidden_regions", []) if r.get("id") != region_id]
    state["hidden_regions"] = regions
    save_state(session_id, state)
    return get_properties(session_id)


def delete_measurement(session_id: str, measurement_id: str) -> dict:
    state = load_state(session_id)
    items = [m for m in state.get("measurements", []) if m.get("id") != measurement_id]
    state["measurements"] = items
    save_state(session_id, state)
    return get_properties(session_id)


def configure_view(
    session_id: str,
    *,
    crs_epsg: int | None = None,
    basemap_enabled: bool | None = None,
    basemap_mode: str | None = None,
    show_axes: bool | None = None,
    color_mode: str | None = None,
    show_grid_surface: bool | None = None,
) -> dict:
    state = load_state(session_id)
    if crs_epsg is not None:
        state["crs"] = {"epsg": crs_epsg, "name": crs_name_for_epsg(crs_epsg)}
    basemap = state.get("basemap", {"enabled": False, "mode": "aerial"})
    if basemap_enabled is not None:
        basemap["enabled"] = bool(basemap_enabled)
    if basemap_mode is not None and basemap_mode in ("aerial", "road", "hybrid", "off"):
        basemap["mode"] = basemap_mode
    state["basemap"] = basemap
    view = state.get("view", {"show_axes": True, "fov": 50, "color_mode": "rgb", "show_grid_surface": False})
    if show_axes is not None:
        view["show_axes"] = bool(show_axes)
    if color_mode is not None and color_mode in ("rgb", "elevation", "intensity", "uniform", "classification"):
        view["color_mode"] = color_mode
    if show_grid_surface is not None:
        view["show_grid_surface"] = bool(show_grid_surface)
    state["view"] = view
    save_state(session_id, state)
    return get_properties(session_id)


def get_grid_surface_json(session_id: str) -> dict | None:
    path = _session_dir(session_id) / "grid_data.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def subsample_session(session_id: str, ratio: float = 0.5) -> dict:
    """Randomly subsample visible point cloud to a fraction of current count."""
    push_undo(session_id)
    pts, cols = load_points_colors(session_id)
    n = len(pts)
    frac = min(max(float(ratio), 0.01), 1.0)
    target = max(1, int(n * frac))
    if target >= n:
        return get_properties(session_id)
    rng = np.random.default_rng(42)
    idx = np.sort(rng.choice(n, target, replace=False))
    new_pts = pts[idx]
    new_cols = cols[idx] if cols is not None and len(cols) == n else None
    cls = load_classifications(session_id)
    new_cls = cls[idx] if len(cls) == n else np.zeros(target, dtype=np.uint8)
    save_points_colors(session_id, new_pts, new_cols, new_cls)
    state = load_state(session_id)
    state = _sync_edited_files(state, len(new_pts))
    save_state(session_id, state)
    result = get_properties(session_id)
    result["removed_count"] = n - target
    return result


def lasso_action(
    session_id: str,
    polygon_ndc: list[list[float]],
    view_matrix: list[float],
    proj_matrix: list[float],
    action: str,
    class_id: int = 0,
) -> dict:
    _pipeline_path()
    from pointcloud_lasso import (
        apply_mask_classify,
        apply_mask_delete,
        bbox_from_mask,
        mask_points_in_screen_polygon,
    )

    pts, cols = load_points_colors(session_id)
    cls = load_classifications(session_id)
    mask = mask_points_in_screen_polygon(pts, polygon_ndc, view_matrix, proj_matrix)
    selected = int(np.sum(mask))
    if selected == 0:
        raise ValueError("Không có điểm trong vùng lasso.")

    if action == "select":
        result = get_properties(session_id)
        result["selected_count"] = selected
        return result

    push_undo(session_id)

    if action == "delete":
        new_pts, new_cols, new_cls, removed = apply_mask_delete(pts, cols, cls, mask)
        save_points_colors(session_id, new_pts, new_cols, new_cls)
        state = load_state(session_id)
        _sync_edited_files(state, len(new_pts))
        save_state(session_id, state)
        result = get_properties(session_id)
        result["removed_count"] = removed
        result["selected_count"] = selected
        return result

    if action == "classify":
        new_cls = apply_mask_classify(cls, mask, class_id)
        save_points_colors(session_id, pts, cols, new_cls)
        result = get_properties(session_id)
        result["classified_count"] = selected
        return result

    if action == "hide":
        bbox = bbox_from_mask(pts, mask)
        if bbox is None:
            raise ValueError("Không thể ẩn vùng lasso.")
        mn, mx = bbox
        state = load_state(session_id)
        regions = state.get("hidden_regions", [])
        regions.append({"id": uuid.uuid4().hex[:8], "min": mn, "max": mx, "hidden": True})
        state["hidden_regions"] = regions
        stack = state.get("undo_stack", [])
        if stack:
            stack.pop()
            state["undo_stack"] = stack
        save_state(session_id, state)
        result = get_properties(session_id)
        result["selected_count"] = selected
        return result

    raise ValueError(f"Hành động không hỗ trợ: {action}")


def classify_polygon(session_id: str, polygon: list[list[float]], class_id: int) -> dict:
    _pipeline_path()
    from pointcloud_filters import _points_in_polygon
    from pointcloud_lasso import apply_mask_classify

    push_undo(session_id)
    pts, cols = load_points_colors(session_id)
    cls = load_classifications(session_id)
    poly = np.asarray(polygon, dtype=np.float64)
    inside = _points_in_polygon(pts[:, :2], poly[:, :2])
    selected = int(np.sum(inside))
    if selected == 0:
        state = load_state(session_id)
        stack = state.get("undo_stack", [])
        if stack:
            stack.pop()
            state["undo_stack"] = stack
            save_state(session_id, state)
        raise ValueError("Không có điểm trong vùng đa giác.")
    new_cls = apply_mask_classify(cls, inside, class_id)
    save_points_colors(session_id, pts, cols, new_cls)
    result = get_properties(session_id)
    result["classified_count"] = selected
    return result


def set_class_visibility(session_id: str, class_id: int, visible: bool) -> dict:
    state = load_state(session_id)
    hidden = set(state.get("hidden_class_ids", []))
    if visible:
        hidden.discard(int(class_id))
    else:
        hidden.add(int(class_id))
    state["hidden_class_ids"] = sorted(hidden)
    save_state(session_id, state)
    return get_properties(session_id)


def extract_cross_section_profile(
    session_id: str,
    start: list[float],
    end: list[float],
    *,
    width: float = 0.5,
    n_samples: int = 200,
) -> dict:
    _pipeline_path()
    from pointcloud_survey import extract_cross_section

    visible_pts, _, _ = get_visible_points(session_id)
    profile = extract_cross_section(visible_pts, start, end, width=width, n_samples=n_samples)
    profile_path = _session_dir(session_id) / "cross_section.json"
    profile_path.write_text(json.dumps(profile, ensure_ascii=False), encoding="utf-8")
    state = load_state(session_id)
    state["last_cross_section"] = {"start": start, "end": end, "width": width}
    save_state(session_id, state)
    return profile


def get_contours(session_id: str, interval: float = 1.0) -> dict:
    _pipeline_path()
    from pointcloud_survey import contour_lines_from_grid

    grid_data = get_grid_surface_json(session_id)
    if grid_data is None:
        raise ValueError("Chưa có lưới IDW — tạo lưới trước (tab Lưới hoặc Xử lý).")
    result = contour_lines_from_grid(grid_data, interval)
    contours_path = _session_dir(session_id) / "contours.json"
    contours_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    state = load_state(session_id)
    state["contours"] = {"interval": interval, "segment_count": result["segment_count"]}
    save_state(session_id, state)
    return result


def compute_volume(session_id: str, base_z: float) -> dict:
    _pipeline_path()
    from pointcloud_survey import compute_grid_volume

    grid_data = get_grid_surface_json(session_id)
    if grid_data is None:
        raise ValueError("Chưa có lưới IDW — tạo lưới trước.")
    result = compute_grid_volume(grid_data, base_z)
    state = load_state(session_id)
    vols = state.get("volumes", [])
    vols.append({"id": uuid.uuid4().hex[:8], **result})
    state["volumes"] = vols[-20:]
    save_state(session_id, state)
    props = get_properties(session_id)
    props["volume_result"] = result
    return props


def check_density(
    session_id: str,
    min_pt: list[float],
    max_pt: list[float],
    cell_size: float,
) -> dict:
    _pipeline_path()
    from pointcloud_survey import compute_region_density

    visible_pts, _, _ = get_visible_points(session_id)
    result = compute_region_density(visible_pts, min_pt, max_pt, cell_size)
    return result


def register_splat_as_points(
    session_id: str,
    splat_path: Path,
    *,
    filter_strength: float = 0.5,
    alpha_threshold: float = 0.05,
    offset: list[float] | None = None,
    scale: float = 1.0,
    swap_xy: bool = False,
) -> dict:
    _pipeline_path()
    from pointcloud_splat import splat_to_point_cloud

    push_undo(session_id)
    pts, cols = splat_to_point_cloud(
        splat_path,
        alpha_threshold=alpha_threshold,
        filter_strength=filter_strength,
        offset=offset,
        scale=scale,
        swap_xy=swap_xy,
    )
    existing_pts, existing_cols = load_points_colors(session_id)
    new_pts = np.vstack([existing_pts, pts]) if len(existing_pts) else pts
    if existing_cols is not None and len(existing_cols) == len(existing_pts):
        new_cols = np.vstack([existing_cols, cols])
    elif cols is not None:
        new_cols = cols if len(existing_pts) == 0 else np.vstack([
            existing_cols if existing_cols is not None else np.full((len(existing_pts), 3), 0.7),
            cols,
        ])
    else:
        new_cols = existing_cols
    cls = load_classifications(session_id)
    new_cls = np.concatenate([cls, np.zeros(len(pts), dtype=np.uint8)]) if len(cls) == len(existing_pts) else np.zeros(len(new_pts), dtype=np.uint8)
    save_points_colors(session_id, new_pts, new_cols, new_cls)
    state = load_state(session_id)
    state = _sync_edited_files(state, len(new_pts))
    state["has_splat"] = True
    save_state(session_id, state)
    result = get_properties(session_id)
    result["added_count"] = len(pts)
    return result


def evaluate_deviation(
    session_id: str,
    design_z: float,
    *,
    tolerance_ok: float = 0.05,
    tolerance_warn: float = 0.15,
) -> dict:
    _pipeline_path()
    from pointcloud_deki import compute_deviation_heatmap

    grid_data = get_grid_surface_json(session_id)
    if grid_data is None:
        raise ValueError("Chưa có lưới IDW — tạo lưới trước.")
    result = compute_deviation_heatmap(
        grid_data,
        design_z=design_z,
        tolerance_ok=tolerance_ok,
        tolerance_warn=tolerance_warn,
    )
    heatmap_path = _session_dir(session_id) / "deviation_heatmap.json"
    heatmap_path.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    state = load_state(session_id)
    state["deviation_heatmap"] = {
        "design_z": design_z,
        "stats": result["stats"],
        "tolerance_ok": tolerance_ok,
        "tolerance_warn": tolerance_warn,
    }
    save_state(session_id, state)
    return result


def get_deviation_heatmap(session_id: str) -> dict | None:
    path = _session_dir(session_id) / "deviation_heatmap.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def import_survey_csv(
    session_id: str,
    csv_text: str,
    *,
    skip_header_rows: int = 0,
    z_flip: bool = False,
    col_x: int = 0,
    col_y: int = 1,
    col_z: int = 2,
) -> dict:
    _pipeline_path()
    from pointcloud_deki import parse_survey_csv

    push_undo(session_id)
    state = load_state(session_id)
    swap = bool(state.get("swap_xy", False))
    pts = parse_survey_csv(
        csv_text,
        skip_header_rows=skip_header_rows,
        swap_xy=swap,
        z_flip=z_flip,
        col_x=col_x,
        col_y=col_y,
        col_z=col_z,
    )
    existing_pts, existing_cols = load_points_colors(session_id)
    new_pts = np.vstack([existing_pts, pts]) if len(existing_pts) else pts
    gray = np.full((len(pts), 3), 0.85, dtype=np.float32)
    if existing_cols is not None and len(existing_cols) == len(existing_pts):
        new_cols = np.vstack([existing_cols, gray])
    else:
        new_cols = gray if len(existing_pts) == 0 else np.vstack([
            existing_cols if existing_cols is not None else np.full((len(existing_pts), 3), 0.7),
            gray,
        ])
    cls = load_classifications(session_id)
    new_cls = np.concatenate([cls, np.zeros(len(pts), dtype=np.uint8)]) if len(cls) == len(existing_pts) else np.zeros(len(new_pts), dtype=np.uint8)
    save_points_colors(session_id, new_pts, new_cols, new_cls)
    state = _sync_edited_files(state, len(new_pts))
    survey_pts = state.get("survey_imports", [])
    survey_pts.append({"count": len(pts), "source": "csv"})
    state["survey_imports"] = survey_pts[-20:]
    save_state(session_id, state)
    result = get_properties(session_id)
    result["imported_count"] = len(pts)
    return result


def save_viewpoint(
    session_id: str,
    name: str,
    camera_pos: list[float],
    target: list[float],
    up: list[float] | None = None,
) -> dict:
    state = load_state(session_id)
    views = state.get("viewpoints", [])
    views.append({
        "id": uuid.uuid4().hex[:8],
        "name": name or f"View {len(views) + 1}",
        "camera": camera_pos,
        "target": target,
        "up": up or [0, 0, 1],
    })
    state["viewpoints"] = views[-30:]
    save_state(session_id, state)
    return get_properties(session_id)


def delete_viewpoint(session_id: str, view_id: str) -> dict:
    state = load_state(session_id)
    state["viewpoints"] = [v for v in state.get("viewpoints", []) if v.get("id") != view_id]
    save_state(session_id, state)
    return get_properties(session_id)
