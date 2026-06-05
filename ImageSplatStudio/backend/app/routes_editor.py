"""Point cloud editor API routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

from app.services.pointcloud_editor import (
    add_breakline,
    add_point_at,
    add_hidden_region,
    clean_outliers,
    clear_hidden_regions,
    configure_grid,
    create_mesh,
    delete_points_at,
    export_session,
    get_grid_binary,
    get_properties,
    mesh_add_vertex,
    mesh_delete_vertex,
    set_file_visibility,
    show_all,
    split_session,
    toggle_swap_xy,
)
from app.services.preview_cache import get_session

router = APIRouter(prefix="/api/pointcloud-editor")


class VisibilityBody(BaseModel):
    file_index: int
    visible: bool


class RegionBody(BaseModel):
    min: list[float] = Field(..., min_length=3, max_length=3)
    max: list[float] = Field(..., min_length=3, max_length=3)


class GridBody(BaseModel):
    enabled: bool = True
    cell_size: float = Field(1.0, gt=0)


class SplitBody(BaseModel):
    axis: int = Field(..., ge=0, le=2)
    value: float


class MeshBody(BaseModel):
    method: str = "poisson"


class PointBody(BaseModel):
    position: list[float] = Field(..., min_length=3, max_length=3)
    radius: float = Field(0.02, gt=0)


class MeshVertexBody(BaseModel):
    position: list[float] = Field(..., min_length=3, max_length=3)


class MeshVertexIndexBody(BaseModel):
    vertex_index: int = Field(..., ge=0)


class BreaklineBody(BaseModel):
    points: list[list[float]] = Field(..., min_length=2)


def _ensure_session(session_id: str) -> None:
    if get_session(session_id) is None:
        raise HTTPException(status_code=404, detail="Phiên preview đã hết hạn.")


@router.get("/{session_id}/properties")
def editor_properties(session_id: str) -> dict:
    _ensure_session(session_id)
    try:
        return get_properties(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/swap-xy")
def editor_swap_xy(session_id: str) -> dict:
    _ensure_session(session_id)
    return toggle_swap_xy(session_id)


@router.post("/{session_id}/visibility")
def editor_visibility(session_id: str, body: VisibilityBody) -> dict:
    _ensure_session(session_id)
    return set_file_visibility(session_id, body.file_index, body.visible)


@router.post("/{session_id}/show-all")
def editor_show_all(session_id: str) -> dict:
    _ensure_session(session_id)
    return show_all(session_id)


@router.post("/{session_id}/hide-region")
def editor_hide_region(session_id: str, body: RegionBody) -> dict:
    _ensure_session(session_id)
    return add_hidden_region(session_id, body.min, body.max)


@router.post("/{session_id}/clear-regions")
def editor_clear_regions(session_id: str) -> dict:
    _ensure_session(session_id)
    return clear_hidden_regions(session_id)


@router.post("/{session_id}/clean-outliers")
def editor_clean(session_id: str) -> dict:
    _ensure_session(session_id)
    try:
        return clean_outliers(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/split")
def editor_split(session_id: str, body: SplitBody) -> dict:
    _ensure_session(session_id)
    try:
        return split_session(session_id, body.axis, body.value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/grid")
def editor_grid(session_id: str, body: GridBody) -> dict:
    _ensure_session(session_id)
    try:
        return configure_grid(session_id, enabled=body.enabled, cell_size=body.cell_size)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{session_id}/grid")
def editor_grid_data(session_id: str) -> Response:
    _ensure_session(session_id)
    data = get_grid_binary(session_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Grid chưa bật.")
    return Response(content=data, media_type="application/octet-stream")


@router.post("/{session_id}/mesh")
def editor_mesh(session_id: str, body: MeshBody) -> dict:
    _ensure_session(session_id)
    method = body.method if body.method in {"poisson", "bpa"} else "poisson"
    try:
        return create_mesh(session_id, method=method)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{session_id}/mesh.obj")
def editor_mesh_download(session_id: str) -> FileResponse:
    _ensure_session(session_id)
    from app.services.pointcloud_editor import get_mesh_path

    try:
        mesh_path = get_mesh_path(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(path=mesh_path, media_type="model/obj", filename="mesh.obj")


@router.get("/{session_id}/export/las")
def editor_export_las(session_id: str) -> FileResponse:
    _ensure_session(session_id)
    try:
        path = export_session(session_id, "las")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FileResponse(path=path, media_type="application/octet-stream", filename="pointcloud.las")


@router.get("/{session_id}/export/txt")
def editor_export_txt(session_id: str) -> FileResponse:
    _ensure_session(session_id)
    try:
        path = export_session(session_id, "txt")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FileResponse(path=path, media_type="text/plain", filename="pointcloud.txt")


@router.post("/{session_id}/points/delete")
def editor_delete_points(session_id: str, body: PointBody) -> dict:
    _ensure_session(session_id)
    try:
        return delete_points_at(session_id, body.position, body.radius)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/points/add")
def editor_add_point(session_id: str, body: MeshVertexBody) -> dict:
    _ensure_session(session_id)
    return add_point_at(session_id, body.position)


@router.post("/{session_id}/breakline")
def editor_breakline(session_id: str, body: BreaklineBody) -> dict:
    _ensure_session(session_id)
    try:
        return add_breakline(session_id, body.points)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/mesh/vertex/add")
def editor_mesh_vertex_add(session_id: str, body: MeshVertexBody) -> dict:
    _ensure_session(session_id)
    try:
        return mesh_add_vertex(session_id, body.position)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{session_id}/mesh/vertex/delete")
def editor_mesh_vertex_delete(session_id: str, body: MeshVertexIndexBody) -> dict:
    _ensure_session(session_id)
    try:
        return mesh_delete_vertex(session_id, body.vertex_index)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
