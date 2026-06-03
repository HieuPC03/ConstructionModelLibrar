"""Offline speech-to-text via faster-whisper (local, no API key)."""

from __future__ import annotations

import asyncio
import os
import shutil
import tempfile
from pathlib import Path

WHISPER_LANG = {"vi": "vi", "ja": "ja", "en": "en", "auto": None}

_model = None
_model_lock = asyncio.Lock()
_model_loading = False


def _cache_dir() -> Path:
    data = os.getenv("MEETING_TRANSLATOR_DATA")
    if data:
        p = Path(data) / "whisper-models"
    else:
        p = Path("whisper-models")
    p.mkdir(parents=True, exist_ok=True)
    return p


def get_offline_model_name() -> str:
    from services.settings_store import load_settings

    env = (os.getenv("WHISPER_OFFLINE_MODEL") or "").strip()
    if env in ("tiny", "base", "small", "medium", "large-v3"):
        return env
    saved = (load_settings().get("whisper_offline_model") or "").strip()
    if saved in ("tiny", "base", "small", "medium"):
        return saved
    return "small"


def _ffmpeg_available() -> bool:
    if shutil.which("ffmpeg"):
        return True
    for candidate in (
        Path(os.getenv("MEETING_TRANSLATOR_DATA") or "") / ".." / "runtime" / "ffmpeg" / "ffmpeg.exe",
        Path(__file__).resolve().parents[2] / "runtime" / "ffmpeg" / "ffmpeg.exe",
    ):
        try:
            if candidate.exists():
                os.environ["PATH"] = str(candidate.parent) + os.pathsep + os.environ.get(
                    "PATH", ""
                )
                return True
        except (OSError, ValueError):
            pass
    resources = os.getenv("RESOURCES_PATH")
    if resources:
        bundled = Path(resources) / "runtime" / "ffmpeg" / "ffmpeg.exe"
        if bundled.exists():
            os.environ["PATH"] = str(bundled.parent) + os.pathsep + os.environ.get("PATH", "")
            return True
    return False


def _load_model_sync():
    from faster_whisper import WhisperModel

    name = get_offline_model_name()
    cache = str(_cache_dir())
    device = "cuda" if os.getenv("WHISPER_OFFLINE_DEVICE", "").lower() == "cuda" else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"
    return WhisperModel(name, device=device, compute_type=compute_type, download_root=cache)


async def ensure_offline_model() -> None:
    """Preload Whisper model (first run may download ~500MB for 'small')."""
    global _model, _model_loading
    if _model is not None:
        return
    async with _model_lock:
        if _model is not None:
            return
        if _model_loading:
            while _model_loading:
                await asyncio.sleep(0.2)
            return
        _model_loading = True
        try:
            _model = await asyncio.to_thread(_load_model_sync)
        finally:
            _model_loading = False


def offline_model_status() -> dict[str, str]:
    name = get_offline_model_name()
    ready = _model is not None
    return {
        "engine": "faster-whisper",
        "model": name,
        "ready": str(ready).lower(),
        "cache_dir": str(_cache_dir()),
        "ffmpeg": str(_ffmpeg_available()).lower(),
    }


def _transcribe_file_sync(path: str, language: str) -> str:
    global _model
    if _model is None:
        _model = _load_model_sync()
    lang = WHISPER_LANG.get(language)
    kwargs: dict = {"beam_size": 5, "vad_filter": True}
    if lang:
        kwargs["language"] = lang
    segments, _info = _model.transcribe(path, **kwargs)
    parts = [seg.text.strip() for seg in segments if seg.text.strip()]
    return " ".join(parts).strip()


async def transcribe_offline(
    audio_bytes: bytes, filename: str = "chunk.webm", language: str = "auto"
) -> str:
    if not audio_bytes or len(audio_bytes) < 400:
        return ""

    if not _ffmpeg_available():
        raise ValueError(
            "Live Caption offline cần FFmpeg. Cài FFmpeg (https://ffmpeg.org) "
            "và thêm vào PATH, hoặc dùng bản cài Meeting Translator đầy đủ."
        )

    await ensure_offline_model()

    suffix = ".webm"
    if "." in filename:
        suffix = filename[filename.rfind(".") :]

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        return await asyncio.to_thread(_transcribe_file_sync, tmp_path, language)
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
