from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass

from services.config import (
    GEMINI_MODEL,
    OPENAI_STT_MODEL,
    get_gemini_api_key,
    get_openai_api_key,
    get_translator_provider,
)
from services.errors import is_valid_gemini_key, is_valid_openai_key
from services.lang_detect import detect_lang_from_text, normalize_lang

WHISPER_LANG = {"vi": "vi", "ja": "ja", "en": "en", "auto": None}


@dataclass
class TranscribeResult:
    text: str
    detected_lang: str | None = None
MIN_AUDIO_BYTES = 280


def _audio_suffix_from_bytes(data: bytes, filename: str) -> str:
    """Đuôi file khớp magic bytes — tránh gửi .webm cho blob Ogg/MP4."""
    if len(data) >= 4 and data[:4] == b"OggS":
        return ".ogg"
    if len(data) >= 4 and data[:4] == b"RIFF":
        return ".wav"
    if len(data) >= 8 and data[4:8] == b"ftyp":
        return ".m4a"
    if len(data) >= 4 and data[:4] == bytes((0x1A, 0x45, 0xDF, 0xA3)):
        return ".webm"
    if "." in filename:
        return filename[filename.rfind(".") :]
    return ".webm"
_GEMINI_LANG_HINT = {
    "vi": "The speech is in Vietnamese.",
    "ja": "The speech is in Japanese.",
    "en": "The speech is in English.",
}


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "chunk.webm",
    language: str = "auto",
    engine: str | None = None,
) -> TranscribeResult:
    if len(audio_bytes) < MIN_AUDIO_BYTES:
        return TranscribeResult("")
    if engine == "openai":
        return await _transcribe_openai(audio_bytes, filename, language)
    if engine == "gemini":
        text = await _transcribe_gemini(audio_bytes, filename, language)
        det = normalize_lang(language) or detect_lang_from_text(text)
        return TranscribeResult(text, det)
    if engine == "offline":
        from services.stt_offline import transcribe_offline

        text = await transcribe_offline(audio_bytes, filename, language)
        det = normalize_lang(language) or detect_lang_from_text(text)
        return TranscribeResult(text, det)

    provider = get_translator_provider()
    if provider == "gemini":
        text = await _transcribe_gemini(audio_bytes, filename, language)
        det = normalize_lang(language) or detect_lang_from_text(text)
        return TranscribeResult(text, det)
    if provider == "google":
        gemini_key = get_gemini_api_key()
        if is_valid_gemini_key(gemini_key):
            return await _transcribe_gemini(audio_bytes, filename, language)
        if gemini_key:
            raise ValueError(
                "GEMINI_API_KEY sai định dạng (AIza... hoặc AQ...., không phải sk-proj OpenAI)."
            )
        raise ValueError(
            "Cần GEMINI_API_KEY (https://aistudio.google.com/apikey) cho nhận dạng giọng."
        )

    try:
        return await _transcribe_openai(audio_bytes, filename, language)
    except Exception as exc:
        msg = str(exc).lower()
        if ("insufficient_quota" in msg or "billing" in msg) and is_valid_gemini_key(
            get_gemini_api_key()
        ):
            text = await _transcribe_gemini(audio_bytes, filename, language)
            det = normalize_lang(language) or detect_lang_from_text(text)
            return TranscribeResult(text, det)
        raise


async def _transcribe_openai(
    audio_bytes: bytes, filename: str, language: str
) -> TranscribeResult:
    api_key = get_openai_api_key()
    if not is_valid_openai_key(api_key):
        raise ValueError(
            "OPENAI_API_KEY không hợp lệ hoặc hết quota. Chọn Google Translate trong Cài đặt."
        )

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)
    lang = WHISPER_LANG.get(language)

    suffix = _audio_suffix_from_bytes(audio_bytes, filename)

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as audio_file:
            kwargs: dict = {"model": OPENAI_STT_MODEL, "file": audio_file}
            if lang:
                kwargs["language"] = lang
            else:
                kwargs["response_format"] = "verbose_json"
            try:
                transcript = await client.audio.transcriptions.create(**kwargs)
            except Exception as primary_exc:
                if "invalid file format" in str(primary_exc).lower():
                    return TranscribeResult("")
                with open(tmp_path, "rb") as fallback_file:
                    fb: dict = {"model": "whisper-1", "file": fallback_file}
                    if lang:
                        fb["language"] = lang
                    else:
                        fb["response_format"] = "verbose_json"
                    try:
                        transcript = await client.audio.transcriptions.create(**fb)
                    except Exception as fb_exc:
                        if "invalid file format" in str(fb_exc).lower():
                            return TranscribeResult("")
                        raise fb_exc from primary_exc
        text = (getattr(transcript, "text", None) or "").strip()
        if not text and isinstance(transcript, dict):
            text = (transcript.get("text") or "").strip()
        raw_lang = getattr(transcript, "language", None)
        if raw_lang is None and isinstance(transcript, dict):
            raw_lang = transcript.get("language")
        detected = normalize_lang(raw_lang) if not lang else normalize_lang(language)
        if not detected and text:
            detected = detect_lang_from_text(text)
        return TranscribeResult(text, detected)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


async def _transcribe_gemini(
    audio_bytes: bytes, filename: str, language: str
) -> str:
    api_key = get_gemini_api_key()
    if not is_valid_gemini_key(api_key):
        raise ValueError(
            "GEMINI_API_KEY không hợp lệ. Lấy key tại https://aistudio.google.com/apikey "
            "(AIza... hoặc AQ....). Không dán key OpenAI (sk-proj)."
        )

    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(GEMINI_MODEL)

    suffix = ".webm"
    if "." in filename:
        suffix = filename[filename.rfind(".") :]

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        audio_file = genai.upload_file(tmp_path)
        lang_hint = _GEMINI_LANG_HINT.get(language, "")
        prompt = (
            "Transcribe this meeting audio. Output ONLY the spoken text, no commentary. "
            + lang_hint
        )
        result = await model.generate_content_async([prompt, audio_file])
        return (result.text or "").strip()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
