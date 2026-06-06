from __future__ import annotations

import asyncio
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
    OPENAI_STT_MODEL,
    OPENAI_TRANSLATE_MODEL,
    PROVIDER_LABELS,
    RECORDINGS_DIR,
    get_openai_api_key,
    get_translator_provider,
)
from services.errors import (
    env_file_hint,
    friendly_api_error,
    is_placeholder_key,
    is_valid_openai_key,
)
from services.settings_store import (
    load_settings,
    reset_settings,
    resolve_export_dir,
    resolve_recordings_dir,
    save_settings,
)
from services.session_modes import (
    SESSION_TRANSLATE,
    SESSION_TRANSCRIPT,
    get_session_mode,
    stt_engine_for_mode,
    text_translate_provider_for_mode,
)
from services.realtime_buffer import (
    merge_stt_fragments,
    should_flush_buffer,
)
from services.stt import transcribe_audio
from services.stt_lang import should_skip_meeting_translation, translation_source_lang
from services.stt_postprocess import polish_stt_text, stt_context_tail
from services.translate import translate_meeting_text, translate_text


def recordings_dir() -> Path:
    return resolve_recordings_dir(RECORDINGS_DIR)

app = FastAPI(
    title="Meeting Realtime Translator",
    description="Dịch họp realtime — capture âm thanh hệ thống, ghi hội thoại, dịch Việt–Nhật",
    version="1.5.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TextTranslateRequest(BaseModel):
    text: str
    source_lang: str = Field(pattern="^(vi|ja|en)$")
    target_lang: str = Field(pattern="^(vi|ja|en)$")
    session_mode: str | None = Field(
        default=None, pattern="^(translate_realtime|transcript)$"
    )
    provider: str | None = Field(
        default=None, pattern="^(google|openai)$"
    )
    use_openai: bool = False
    meeting: bool = False


class TranscriptSegmentExport(BaseModel):
    index: int = 1
    original: str = ""
    translation: str = ""


class TextTranslateResponse(BaseModel):
    translation: str
    provider: str
    notice: str | None = None


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

    openai_ok = is_valid_openai_key(get_openai_api_key())
    stt = f"OpenAI STT ({OPENAI_STT_MODEL})"
    hints = [
        "Dịch văn bản: Google / ChatGPT.",
        f"Live Caption + dịch meeting: {stt} — cần OPENAI_API_KEY.",
    ]
    msg = None if openai_ok else f"Thêm OPENAI_API_KEY trong {config_path}"
    if provider == "google":
        return openai_ok, label, stt, " ".join(hints) if not openai_ok else None
    return openai_ok, label, OPENAI_TRANSLATE_MODEL, msg


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
        default=None, pattern="^(openai|google)$"
    )
    session_mode: str | None = Field(
        default=None, pattern="^(translate_realtime|transcript)$"
    )
    theme: str | None = Field(default=None, pattern="^(dark|light|ocean|jasty)$")
    whisper_offline_model: str | None = Field(
        default=None, pattern="^(tiny|base|small|medium)$"
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
        "session_mode": get_session_mode(),
        "text_translate_via": text_translate_provider_for_mode(get_session_mode()),
        "live_stt_via": stt_engine_for_mode(get_session_mode()),
        "whisper_offline": _offline_stt_info(),
    }


def _offline_stt_info() -> dict[str, str]:
    from services.stt_offline import get_offline_model_name, offline_model_status

    return {**offline_model_status(), "model_default": get_offline_model_name()}


@app.patch("/api/settings")
async def patch_settings(body: SettingsUpdate) -> dict[str, Any]:
    data = body.model_dump(exclude_none=True)
    saved = save_settings(data)
    return {**saved, "recordings_dir_active": str(recordings_dir())}


@app.post("/api/settings/reset")
async def reset_settings_endpoint() -> dict[str, Any]:
    saved = reset_settings()
    return {
        **saved,
        "recordings_dir_active": str(recordings_dir()),
        "session_mode": get_session_mode(),
        "translator_provider": get_translator_provider(),
        "message": "Đã đặt lại cài đặt mặc định",
    }


@app.post("/api/stt/offline/warmup")
async def warmup_offline_stt() -> dict[str, Any]:
    """Nạp model Whisper (đã gói trong installer hoặc tải về AppData)."""
    from services.stt_offline import (
        ensure_offline_model,
        get_offline_model_name,
        is_whisper_prebundled,
        offline_model_status,
    )

    try:
        await ensure_offline_model()
        name = get_offline_model_name()
        if is_whisper_prebundled(name):
            msg = f"Whisper '{name}' sẵn sàng (đã cài kèm app, không cần tải thêm)"
        else:
            msg = (
                f"Whisper '{name}' sẵn sàng. "
                "Model này chưa gói sẵn — lần đầu có thể tải ~500MB vào AppData."
            )
        return {"ok": True, "message": msg, **offline_model_status()}
    except Exception as exc:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=friendly_api_error(exc)) from exc


@app.get("/api/stt/offline/status")
async def offline_stt_status() -> dict[str, str]:
    from services.stt_offline import offline_model_status

    return offline_model_status()


@app.post("/api/config/test")
async def test_provider_config() -> dict[str, Any]:
    from fastapi import HTTPException

    mode = get_session_mode()
    via = text_translate_provider_for_mode(mode)
    try:
        if mode == SESSION_TRANSCRIPT:
            if not is_valid_openai_key(get_openai_api_key()):
                raise HTTPException(
                    status_code=400,
                    detail=f"Live Caption cần OPENAI_API_KEY trong {env_file_hint()}",
                )
            return {
                "ok": True,
                "message": (
                    f"Live Caption OK — OpenAI STT ({OPENAI_STT_MODEL}). "
                    "Cần quota API OpenAI."
                ),
            }
        if via == "google":
            outcome = await translate_text("xin chào", "vi", "ja")
            if not outcome.text:
                raise ValueError("Google Translate không trả kết quả")
            return {
                "ok": True,
                "message": f"Google Translate OK (ví dụ: xin chào → {outcome.text})",
            }
        if mode == SESSION_TRANSLATE:
            if not is_valid_openai_key(get_openai_api_key()):
                raise HTTPException(
                    status_code=400,
                    detail=f"Cần OPENAI_API_KEY trong {env_file_hint()}",
                )
            outcome = await translate_meeting_text("xin chào", "vi", "ja")
            msg = f"Dịch meeting OK ({outcome.provider}: {outcome.text})"
            if outcome.notice:
                msg += f" — {outcome.notice}"
            return {"ok": True, "message": msg}
        if not is_valid_openai_key(get_openai_api_key()):
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
    segments: list[TranscriptSegmentExport] | None = None
    save_dir: str | None = None
    filename: str = "meeting-transcript.txt"


@app.post("/api/export/text")
async def export_text(body: ExportRequest) -> dict[str, str]:
    lines: list[str] = []
    if body.segments:
        for seg in body.segments:
            lines.append(f"=== Đoạn {seg.index} ===")
            lines.append(seg.original.strip())
            if seg.translation.strip():
                lines.append("")
                lines.append(seg.translation.strip())
            lines.append("")
    elif body.utterances:
        for u in body.utterances:
            ts = u.get("timestamp", "")
            time_part = f" {ts}" if ts else ""
            lines.append(
                f"[{u.get('speaker', '?')}{time_part}] {u.get('original', '')}"
            )
            if u.get("translation"):
                lines.append(f"  → {u['translation']}")
            lines.append("")
    content = "\n".join(lines).strip() or "(trống)"

    out_dir = Path(body.save_dir) if body.save_dir else resolve_export_dir(recordings_dir())
    out_dir.mkdir(parents=True, exist_ok=True)
    safe_name = "".join(c for c in body.filename if c.isalnum() or c in "._- ") or "export.txt"
    out_path = out_dir / safe_name
    out_path.write_text(content, encoding="utf-8")
    return {"path": str(out_path), "message": "Đã lưu văn bản"}


@app.post("/api/translate/text", response_model=TextTranslateResponse)
async def translate_text_endpoint(body: TextTranslateRequest) -> TextTranslateResponse:
    if body.meeting:
        via = "openai"
        try:
            outcome = await translate_meeting_text(
                body.text,
                body.source_lang,
                body.target_lang,
            )
        except Exception as exc:
            from fastapi import HTTPException

            raise HTTPException(
                status_code=400,
                detail=friendly_api_error(exc, provider_hint=via),
            ) from exc
        return TextTranslateResponse(
            translation=outcome.text,
            provider=outcome.provider,
            notice=outcome.notice,
        )

    if body.provider:
        via = body.provider
    elif body.use_openai:
        via = "openai"
    else:
        via = "google"

    try:
        outcome = await translate_text(
            body.text,
            body.source_lang,
            body.target_lang,
            provider_override=via,
        )
    except Exception as exc:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=400,
            detail=friendly_api_error(exc, provider_hint=via),
        ) from exc
    label = outcome.provider or PROVIDER_LABELS.get(via, via)
    return TextTranslateResponse(
        translation=outcome.text,
        provider=label,
        notice=outcome.notice,
    )


@app.post("/api/transcribe")
async def transcribe_endpoint(
    audio: UploadFile = File(...),
    source_lang: str = Form("ja"),
    target_lang: str = Form("vi"),
    speaker: str = Form("remote"),
) -> dict[str, Any]:
    data = await audio.read()
    text = await transcribe_audio(data, audio.filename or "chunk.webm", source_lang)
    return {
        "speaker": speaker,
        "original": text,
        "translation": "",
        "source_lang": source_lang,
    }


@app.websocket("/ws/session")
async def session_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    session_id = str(uuid.uuid4())
    transcript_log: list[dict[str, Any]] = []

    pending_meta: dict[str, Any] = {}
    pending_rt_text = ""
    rt_silence_streak = 0
    stt_context_tail_text = ""
    rt_prior_original = ""
    last_source_lang = "ja"
    last_target_lang = "vi"
    last_speaker = "remote"
    last_session_mode = SESSION_TRANSCRIPT

    async def emit_utterance(
        original: str,
        translation: str,
        speaker: str,
        session_mode: str,
    ) -> None:
        if not original.strip():
            return
        entry = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "speaker": speaker,
            "original": original.strip(),
            "translation": translation,
            "session_mode": session_mode,
        }
        transcript_log.append(entry)
        await websocket.send_json({"type": "utterance", **entry})

    async def flush_realtime_buffer() -> None:
        nonlocal pending_rt_text, rt_silence_streak, stt_context_tail_text, rt_prior_original
        raw = pending_rt_text.strip()
        if not raw:
            return
        pending_rt_text = ""
        rt_silence_streak = 0
        text = polish_stt_text(raw, last_source_lang)
        if not text:
            return
        src = translation_source_lang(last_source_lang)
        translation = ""
        if not should_skip_meeting_translation(text, src, last_target_lang):
            tr = await translate_meeting_text(
                text,
                src,
                last_target_lang,
                prior_context=rt_prior_original,
            )
            translation = tr.text
        await emit_utterance(
            text,
            translation,
            last_speaker,
            SESSION_TRANSLATE,
        )
        rt_prior_original = text
        stt_context_tail_text = stt_context_tail(text)

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
                    if last_session_mode == SESSION_TRANSLATE:
                        await flush_realtime_buffer()
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
                source_lang = meta.get("source_lang", "ja")
                target_lang = meta.get("target_lang", "vi")
                speaker = meta.get("speaker", "remote")
                session_mode = get_session_mode(meta.get("session_mode"))
                stt_engine = stt_engine_for_mode(session_mode)

                try:
                    last_source_lang = source_lang
                    last_target_lang = target_lang
                    last_speaker = speaker
                    last_session_mode = session_mode

                    whisper_ctx = stt_context_tail_text
                    if pending_rt_text.strip():
                        whisper_ctx = stt_context_tail(
                            f"{stt_context_tail_text} {pending_rt_text}".strip()
                        )

                    text = await transcribe_audio(
                        data,
                        meta.get("filename", "chunk.webm"),
                        source_lang,
                        engine=stt_engine,
                        target_lang=target_lang,
                        context_tail=whisper_ctx,
                    )

                    if session_mode == SESSION_TRANSLATE:
                        chunk = (text or "").strip()
                        if not chunk:
                            rt_silence_streak += 1
                        else:
                            rt_silence_streak = 0
                            pending_rt_text = merge_stt_fragments(
                                pending_rt_text, chunk
                            )
                            pending_rt_text = polish_stt_text(
                                pending_rt_text, source_lang
                            )
                        if pending_rt_text.strip():
                            await websocket.send_json(
                                {
                                    "type": "partial",
                                    "original": pending_rt_text.strip(),
                                }
                            )
                        if should_flush_buffer(pending_rt_text, rt_silence_streak):
                            await flush_realtime_buffer()
                    elif text and text.strip():
                        polished = polish_stt_text(text.strip(), source_lang)
                        if polished:
                            await emit_utterance(
                                polished,
                                "",
                                speaker,
                                session_mode,
                            )
                            stt_context_tail_text = stt_context_tail(
                                stt_context_tail_text + polished
                            )
                except Exception as exc:
                    await websocket.send_json(
                        {"type": "error", "message": friendly_api_error(exc)}
                    )
                continue

    except WebSocketDisconnect:
        if last_session_mode == SESSION_TRANSLATE and pending_rt_text.strip():
            try:
                await flush_realtime_buffer()
            except Exception:
                pass
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
    audio: UploadFile | None = File(None),
    video: UploadFile | None = File(None),
    transcript_json: str = Form("[]"),
) -> dict[str, str]:
    out_dir = recordings_dir() / session_id
    out_dir.mkdir(parents=True, exist_ok=True)
    result: dict[str, str] = {"session_id": session_id}

    if audio and audio.filename:
        ext = Path(audio.filename).suffix or ".webm"
        audio_path = out_dir / f"recording-audio{ext}"
        content = await audio.read()
        async with aiofiles.open(audio_path, "wb") as f:
            await f.write(content)
        result["audio_path"] = str(audio_path)

    if video and video.filename:
        ext = Path(video.filename).suffix.lower()
        if ext not in (".mp4", ".webm", ".mkv"):
            ext = ".webm"
        video_path = out_dir / f"recording-video{ext}"
        content = await video.read()
        async with aiofiles.open(video_path, "wb") as f:
            await f.write(content)
        result["video_path"] = str(video_path)

    transcript_path = out_dir / "transcript_client.json"
    async with aiofiles.open(transcript_path, "w", encoding="utf-8") as f:
        await f.write(transcript_json)
    result["transcript_path"] = str(transcript_path)
    return result


class ExportVideoRequest(BaseModel):
    session_id: str
    save_dir: str | None = None
    filename: str = "meeting-recording.mp4"


@app.post("/api/export/video")
async def export_video_to_folder(body: ExportVideoRequest) -> dict[str, str]:
    """Copy session video file to user-chosen folder (.mp4 or .webm)."""
    session_dir = recordings_dir() / body.session_id
    if not session_dir.exists():
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Session not found")
    videos = list(session_dir.glob("recording-video.*"))
    if not videos:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="No video recording for session")
    src = videos[0]
    out_dir = Path(body.save_dir) if body.save_dir else resolve_export_dir(recordings_dir())
    out_dir.mkdir(parents=True, exist_ok=True)
    safe = "".join(c for c in body.filename if c.isalnum() or c in "._- ") or "meeting-recording.mp4"
    if not safe.lower().endswith((".mp4", ".webm")):
        safe += src.suffix
    dest = out_dir / safe
    dest.write_bytes(src.read_bytes())
    return {"path": str(dest), "message": f"Đã lưu video → {dest}"}


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
        audio_files = list(path.glob("recording-audio.*")) + list(path.glob("recording.*"))
        video_files = list(path.glob("recording-video.*"))
        sessions.append(
            {
                "session_id": path.name,
                "has_transcript": transcript.exists() or client_transcript.exists(),
                "has_audio": len(audio_files) > 0,
                "has_video": len(video_files) > 0,
                "audio_file": audio_files[0].name if audio_files else None,
                "video_file": video_files[0].name if video_files else None,
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


@app.get("/api/ws-check")
async def ws_check() -> dict[str, str]:
    """Kiểm tra API sống; client dùng trước khi mở WebSocket."""
    return {"ok": "true", "ws_path": "/ws/session"}


# Giao diện desktop: một cổng phục vụ cả API + React (không cần trình duyệt)
_FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _FRONTEND_DIST.is_dir() and (_FRONTEND_DIST / "index.html").exists():

    @app.get("/")
    async def spa_index() -> FileResponse:
        return FileResponse(_FRONTEND_DIST / "index.html")

    app.mount(
        "/assets",
        StaticFiles(directory=str(_FRONTEND_DIST / "assets")),
        name="frontend_assets",
    )

    @app.get("/jasty-logo.png")
    async def serve_jasty_logo() -> FileResponse:
        logo = _FRONTEND_DIST / "jasty-logo.png"
        if logo.is_file():
            return FileResponse(logo)
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Logo not found")
