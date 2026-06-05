"""Point cloud editor session operations."""

from __future__ import annotations

import sys
import uuid
from pathlib import Path

import numpy as np

from app.config import settings
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


def save_points_colors(session_id: str, points: np.ndarray, colors: np.ndarray | None) -> None:
    session = get_session(session_id)
    if session is None:
        raise ValueError("Phiên preview đã hết hạn — tải lại file.")
    np.save(session.points_path, np.asarray(points, dtype=np.float32))
    if colors is not None:
        if session.colors_path is None:
            session.colors_path = session.points_path.parent / "colors.npy"
        np.save(session.colors_path, np.asarray(colors, dtype=np.float32))
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
        "grid": state.get("grid", {"enabled": False, "cell_size": 1.0}),
        "mesh": state.get("mesh"),
        "breaklines": state.get("breaklines", []),
        "coord_points": state.get("coord_points", []),
        "measurements": state.get("measurements", []),
        "can_undo": len(state.get("undo_stack", [])) > 0,
        "can_redo": len(state.get("redo_stack", [])) > 0,
        "bounds": bbox,
        "norm_meta": state.get("norm_meta", {}),
        "crs": state.get("crs", {"epsg": 6668, "name": "JGD2011"}),
        "basemap": state.get("basemap", {"enabled": False}),
        "view": state.get("view", {"show_axes": True, "fov": 50}),
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


def configure_grid(session_id: str, *, enabled: bool, cell_size: float) -> dict:
    _pipeline_path()
    from pointcloud_editor_ops import build_square_grid_lines, pack_grid_lines

    state = load_state(session_id)
    cell = max(float(cell_size), 0.01)
    state["grid"] = {"enabled": bool(enabled), "cell_size": cell}
    pts, _ = load_points_colors(session_id)
    mn = np.min(pts, axis=0)
    mx = np.max(pts, axis=0)
    lines = build_square_grid_lines(mn, mx, cell)
    grid_path = _session_dir(session_id) / "grid.bin"
    grid_path.write_bytes(pack_grid_lines(lines))
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


def create_mesh(session_id: str, method: str = "poisson") -> dict:
    _pipeline_path()
    from pointcloud_editor_ops import mesh_from_points

    visible_pts, visible_cols, state = get_visible_points(session_id)
    if len(visible_pts) < 100:
        raise ValueError("Cần ít nhất 100 điểm hiển thị để tạo mesh.")
    mesh_path = _session_dir(session_id) / "mesh.obj"
    info = mesh_from_points(visible_pts, visible_cols, mesh_path, method=method)
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


def delete_points_at(session_id: str, position: list[float], radius: float = 0.02) -> dict:
    _pipeline_path()
    from pointcloud_mesh_edit import delete_points_near

    push_undo(session_id)
    pts, cols = load_points_colors(session_id)
    new_pts, new_cols, removed = delete_points_near(pts, cols, position, radius)
    if removed == 0:
        state = load_state(session_id)
        stack = state.get("undo_stack", [])
        if stack:
            stack.pop()
            state["undo_stack"] = stack
            save_state(session_id, state)
        raise ValueError("Không tìm thấy điểm trong vùng chọn.")
    save_points_colors(session_id, new_pts, new_cols)
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
    save_points_colors(session_id, new_pts, new_cols)
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
    save_points_colors(session_id, new_pts, new_cols)
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
    new_pts, new_cols, removed = delete_points_in_polygon_xy(pts, cols, polygon)
    if removed == 0:
        state = load_state(session_id)
        stack = state.get("undo_stack", [])
        if stack:
            stack.pop()
            state["undo_stack"] = stack
            save_state(session_id, state)
        raise ValueError("Không có điểm trong vùng đa giác.")
    save_points_colors(session_id, new_pts, new_cols)
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
    show_axes: bool | None = None,
) -> dict:
    state = load_state(session_id)
    if crs_epsg is not None:
        names = {6668: "JGD2011", 6677: "JGD2011 / Plane VII", 4326: "WGS84", 0: "Local"}
        state["crs"] = {"epsg": crs_epsg, "name": names.get(crs_epsg, f"EPSG:{crs_epsg}")}
    if basemap_enabled is not None:
        state["basemap"] = {"enabled": bool(basemap_enabled)}
    if show_axes is not None:
        view = state.get("view", {"show_axes": True, "fov": 50})
        view["show_axes"] = bool(show_axes)
        state["view"] = view
    save_state(session_id, state)
    return get_properties(session_id)
