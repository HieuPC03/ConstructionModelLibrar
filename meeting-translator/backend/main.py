from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiofiles
from fastapi import FastAPI, File, Form, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from services.config import (
    GEMINI_MODEL,
    OPENAI_STT_MODEL,
    OPENAI_TRANSLATE_MODEL,
    PROVIDER_LABELS,
    RECORDINGS_DIR,
    get_gemini_api_key,
    get_openai_api_key,
    get_translator_provider,
)
from services.errors import env_file_hint, friendly_api_error, is_placeholder_key
from services.settings_store import load_settings, resolve_export_dir, resolve_recordings_dir, save_settings
from services.stt import transcribe_audio
from services.translate import translate_text


def recordings_dir() -> Path:
    return resolve_recordings_dir(RECORDINGS_DIR)

app = FastAPI(
    title="Meeting Realtime Translator",
    description="Dịch họp realtime — capture âm thanh hệ thống, ghi hội thoại, dịch Việt–Nhật",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TextTranslateRequest(BaseModel):
    text: str
    source_lang: str = Field(pattern="^(vi|ja|en)$")
    target_lang: str = Field(pattern="^(vi|ja|en)$")


class TextTranslateResponse(BaseModel):
    translation: str
    provider: str


class HealthResponse(BaseModel):
    status: str
    provider: str
    stt: str
    api_key_ok: bool
    config_path: str
    message: str | None = None


def _provider_health() -> tuple[bool, str, str, str | None]:
    config_path = env_file_hint()
    provider = get_translator_provider()
    label = PROVIDER_LABELS.get(provider, provider)

    if provider == "google":
        has_gemini = not is_placeholder_key(get_gemini_api_key())
        stt = GEMINI_MODEL if has_gemini else "cần GEMINI_API_KEY"
        msg = None
        if not has_gemini:
            msg = (
                f"Dịch văn bản: Google Translate (không cần key). "
                f"Dịch họp realtime: thêm GEMINI_API_KEY vào {config_path}"
            )
        return True, label, stt, msg

    if provider == "gemini":
        ok = not is_placeholder_key(get_gemini_api_key())
        msg = (
            None
            if ok
            else f"Thêm GEMINI_API_KEY vào {config_path} (https://aistudio.google.com/apikey)"
        )
        return ok, label, GEMINI_MODEL, msg

    ok = not is_placeholder_key(get_openai_api_key())
    msg = (
        None
        if ok
        else (
            f"Thêm OPENAI_API_KEY hoặc đổi TRANSLATOR_PROVIDER=google/gemini trong {config_path}"
        )
    )
    return ok, label, OPENAI_STT_MODEL, msg


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    config_path = env_file_hint()
    api_ok, label, stt, message = _provider_health()
    return HealthResponse(
        status="ok" if api_ok else "config_required",
        provider=label,
        stt=stt,
        api_key_ok=api_ok,
        config_path=config_path,
        message=message,
    )


class SettingsUpdate(BaseModel):
    recordings_dir: str | None = None
    export_dir: str | None = None
    ui_language: str | None = Field(default=None, pattern="^(vi|ja)$")
    default_source_lang: str | None = Field(default=None, pattern="^(vi|ja|en|auto)$")
    default_target_lang: str | None = Field(default=None, pattern="^(vi|ja|en)$")
    meeting_pair: str | None = Field(default=None, pattern="^(vi-ja|ja-vi)$")
    translator_provider: str | None = Field(
        default=None, pattern="^(openai|gemini|google)$"
    )


@app.get("/api/settings")
async def get_settings() -> dict[str, Any]:
    s = load_settings()
    return {
        **s,
        "config_path": env_file_hint(),
        "recordings_dir_active": str(recordings_dir()),
        "translate_model": OPENAI_TRANSLATE_MODEL,
        "provider": PROVIDER_LABELS.get(get_translator_provider(), "openai"),
        "translator_provider": get_translator_provider(),
    }


@app.patch("/api/settings")
async def patch_settings(body: SettingsUpdate) -> dict[str, Any]:
    data = body.model_dump(exclude_none=True)
    saved = save_settings(data)
    return {**saved, "recordings_dir_active": str(recordings_dir())}


@app.post("/api/config/test")
async def test_provider_config() -> dict[str, Any]:
    from fastapi import HTTPException

    provider = get_translator_provider()
    try:
        if provider == "google":
            result = await translate_text("xin chào", "vi", "ja")
            if not result:
                raise ValueError("Google Translate không trả kết quả")
            return {
                "ok": True,
                "message": f"Google Translate OK (ví dụ: xin chào → {result})",
            }
        if provider == "gemini":
            if is_placeholder_key(get_gemini_api_key()):
                raise HTTPException(
                    status_code=400,
                    detail=f"Thiếu GEMINI_API_KEY trong {env_file_hint()}",
                )
            result = await translate_text("test", "en", "vi")
            return {"ok": True, "message": f"Gemini OK (thử dịch: {result})"}
        if is_placeholder_key(get_openai_api_key()):
            raise HTTPException(
                status_code=400,
                detail=f"Thiếu OPENAI_API_KEY trong {env_file_hint()}",
            )
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=get_openai_api_key())
        await client.chat.completions.create(
            model=OPENAI_TRANSLATE_MODEL,
            messages=[{"role": "user", "content": "reply OK"}],
            max_tokens=8,
        )
        return {"ok": True, "message": "ChatGPT API hoạt động bình thường."}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=friendly_api_error(exc)) from exc


class ExportRequest(BaseModel):
    session_id: str | None = None
    utterances: list[dict[str, Any]] | None = None
    save_dir: str | None = None
    filename: str = "meeting-transcript.txt"


@app.post("/api/export/text")
async def export_text(body: ExportRequest) -> dict[str, str]:
    lines: list[str] = []
    if body.utterances:
        for u in body.utterances:
            lines.append(f"[{u.get('speaker', '?')}] {u.get('original', '')}")
            if u.get("translation"):
                lines.append(f"  → {u['translation']}")
            lines.append("")
    content = "\n".join(lines) or "(trống)"

    out_dir = Path(body.save_dir) if body.save_dir else resolve_export_dir(recordings_dir())
    out_dir.mkdir(parents=True, exist_ok=True)
    safe_name = "".join(c for c in body.filename if c.isalnum() or c in "._- ") or "export.txt"
    out_path = out_dir / safe_name
    out_path.write_text(content, encoding="utf-8")
    return {"path": str(out_path), "message": "Đã lưu văn bản"}


@app.post("/api/translate/text", response_model=TextTranslateResponse)
async def translate_text_endpoint(body: TextTranslateRequest) -> TextTranslateResponse:
    try:
        result = await translate_text(body.text, body.source_lang, body.target_lang)
    except Exception as exc:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=friendly_api_error(exc)) from exc
    return TextTranslateResponse(
        translation=result,
        provider=PROVIDER_LABELS.get(get_translator_provider(), "openai"),
    )


@app.post("/api/transcribe")
async def transcribe_endpoint(
    audio: UploadFile = File(...),
    source_lang: str = Form("auto"),
    target_lang: str = Form("vi"),
    speaker: str = Form("remote"),
) -> dict[str, Any]:
    data = await audio.read()
    text = await transcribe_audio(data, audio.filename or "chunk.webm", source_lang)
    translation = ""
    if text:
        translation = await translate_text(text, source_lang if source_lang != "auto" else "en", target_lang)
    return {
        "speaker": speaker,
        "original": text,
        "translation": translation,
        "source_lang": source_lang,
        "target_lang": target_lang,
    }


@app.websocket("/ws/session")
async def session_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    session_id = str(uuid.uuid4())
    transcript_log: list[dict[str, Any]] = []

    pending_meta: dict[str, Any] = {}

    try:
        await websocket.send_json(
            {
                "type": "ready",
                "session_id": session_id,
                "message": "Kết nối phiên dịch. Gửi audio chunk hoặc lệnh.",
            }
        )

        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                break

            if "text" in message and message["text"]:
                payload = json.loads(message["text"])
                msg_type = payload.get("type")
                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue
                if msg_type == "end_session":
                    await _save_session(session_id, transcript_log, payload)
                    await websocket.send_json(
                        {"type": "session_saved", "session_id": session_id}
                    )
                    break
                if "filename" in payload or "source_lang" in payload:
                    pending_meta = payload
                continue

            if "bytes" in message and message["bytes"]:
                meta = pending_meta
                pending_meta = {}
                data = message["bytes"]
                source_lang = meta.get("source_lang", "auto")
                target_lang = meta.get("target_lang", "vi")
                speaker = meta.get("speaker", "remote")

                try:
                    text = await transcribe_audio(
                        data, meta.get("filename", "chunk.webm"), source_lang
                    )
                    translation = ""
                    if text:
                        src = source_lang if source_lang != "auto" else "en"
                        translation = await translate_text(text, src, target_lang)

                    entry = {
                        "id": str(uuid.uuid4()),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "speaker": speaker,
                        "original": text,
                        "translation": translation,
                    }
                    transcript_log.append(entry)
                    await websocket.send_json({"type": "utterance", **entry})
                except Exception as exc:
                    await websocket.send_json(
                        {"type": "error", "message": friendly_api_error(exc)}
                    )
                continue

    except WebSocketDisconnect:
        if transcript_log:
            await _save_session(session_id, transcript_log, {})
    except Exception as exc:
        try:
            await websocket.send_json(
                {"type": "error", "message": friendly_api_error(exc)}
            )
        except Exception:
            pass


async def _save_session(
    session_id: str,
    transcript: list[dict[str, Any]],
    meta: dict[str, Any],
) -> Path:
    out_dir = recordings_dir() / session_id
    out_dir.mkdir(parents=True, exist_ok=True)

    log_path = out_dir / "transcript.json"
    async with aiofiles.open(log_path, "w", encoding="utf-8") as f:
        await f.write(
            json.dumps(
                {
                    "session_id": session_id,
                    "saved_at": datetime.now(timezone.utc).isoformat(),
                    "meta": meta,
                    "utterances": transcript,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    return log_path


@app.post("/api/recordings/upload")
async def upload_recording(
    session_id: str = Form(...),
    audio: UploadFile = File(...),
    transcript_json: str = Form("[]"),
) -> dict[str, str]:
    out_dir = recordings_dir() / session_id
    out_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(audio.filename or "recording.webm").suffix or ".webm"
    audio_path = out_dir / f"recording{ext}"
    content = await audio.read()
    async with aiofiles.open(audio_path, "wb") as f:
        await f.write(content)

    transcript_path = out_dir / "transcript_client.json"
    async with aiofiles.open(transcript_path, "w", encoding="utf-8") as f:
        await f.write(transcript_json)

    return {
        "session_id": session_id,
        "audio_path": str(audio_path),
        "transcript_path": str(transcript_path),
    }


@app.get("/api/recordings")
async def list_recordings() -> list[dict[str, Any]]:
    sessions = []
    base = recordings_dir()
    if not base.exists():
        return sessions
    for path in sorted(base.iterdir(), reverse=True):
        if not path.is_dir():
            continue
        transcript = path / "transcript.json"
        client_transcript = path / "transcript_client.json"
        audio_files = list(path.glob("recording.*"))
        sessions.append(
            {
                "session_id": path.name,
                "has_transcript": transcript.exists() or client_transcript.exists(),
                "has_audio": len(audio_files) > 0,
                "audio_file": audio_files[0].name if audio_files else None,
            }
        )
    return sessions


@app.get("/api/recordings/{session_id}/transcript")
async def get_transcript(session_id: str) -> FileResponse:
    for name in ("transcript.json", "transcript_client.json"):
        p = recordings_dir() / session_id / name
        if p.exists():
            return FileResponse(p, media_type="application/json")
    from fastapi import HTTPException

    raise HTTPException(status_code=404, detail="Transcript not found")


# Giao diện desktop: một cổng phục vụ cả API + React (không cần trình duyệt)
_FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _FRONTEND_DIST.is_dir() and (_FRONTEND_DIST / "index.html").exists():
    app.mount(
        "/",
        StaticFiles(directory=str(_FRONTEND_DIST), html=True),
        name="frontend",
    )
