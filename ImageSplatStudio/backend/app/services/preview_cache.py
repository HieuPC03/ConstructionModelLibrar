"""In-memory preview session registry with on-disk point cloud cache."""

from __future__ import annotations

import shutil
import time
import uuid
from dataclasses import dataclass
from pathlib import Path

from app.config import settings

SESSION_TTL_SECONDS = 3600


@dataclass
class PreviewSession:
    session_id: str
    total_points: int
    points_path: Path
    colors_path: Path | None
    file_count: int
    format: str
    created_at: float


_sessions: dict[str, PreviewSession] = {}


def _cache_root() -> Path:
    root = settings.data_dir / "preview_cache"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _purge_expired() -> None:
    now = time.time()
    expired = [
        sid
        for sid, session in _sessions.items()
        if now - session.created_at > SESSION_TTL_SECONDS
    ]
    for sid in expired:
        delete_session(sid)


def create_session(
    points,
    colors,
    *,
    file_count: int,
    format_name: str,
) -> PreviewSession:
    import numpy as np

    _purge_expired()
    session_id = uuid.uuid4().hex
    session_dir = _cache_root() / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    points_path = session_dir / "points.npy"
    np.save(points_path, np.asarray(points, dtype=np.float32))

    colors_path: Path | None = None
    if colors is not None:
        colors_path = session_dir / "colors.npy"
        np.save(colors_path, np.asarray(colors, dtype=np.float32))

    session = PreviewSession(
        session_id=session_id,
        total_points=int(len(points)),
        points_path=points_path,
        colors_path=colors_path,
        file_count=file_count,
        format=format_name,
        created_at=time.time(),
    )
    _sessions[session_id] = session
    return session


def get_session(session_id: str) -> PreviewSession | None:
    _purge_expired()
    session = _sessions.get(session_id)
    if session is None:
        return None
    if time.time() - session.created_at > SESSION_TTL_SECONDS:
        delete_session(session_id)
        return None
    return session


def delete_session(session_id: str) -> None:
    session = _sessions.pop(session_id, None)
    if session is None:
        return
    session_dir = session.points_path.parent
    shutil.rmtree(session_dir, ignore_errors=True)
