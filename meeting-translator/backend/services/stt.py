from __future__ import annotations

import os
import tempfile

from services.config import (
    GEMINI_MODEL,
    OPENAI_STT_MODEL,
    get_gemini_api_key,
    get_openai_api_key,
    get_translator_provider,
)

WHISPER_LANG = {"vi": "vi", "ja": "ja", "en": "en", "auto": None}
_GEMINI_LANG_HINT = {
    "vi": "The speech is in Vietnamese.",
    "ja": "The speech is in Japanese.",
    "en": "The speech is in English.",
}


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "chunk.webm",
    language: str = "auto",
) -> str:
    provider = get_translator_provider()

    if provider == "gemini":
        return await _transcribe_gemini(audio_bytes, filename, language)
    if provider == "google":
        if get_gemini_api_key():
            return await _transcribe_gemini(audio_bytes, filename, language)
        return await _transcribe_openai(audio_bytes, filename, language)

    try:
        return await _transcribe_openai(audio_bytes, filename, language)
    except Exception as exc:
        msg = str(exc).lower()
        if ("insufficient_quota" in msg or "billing" in msg) and get_gemini_api_key():
            return await _transcribe_gemini(audio_bytes, filename, language)
        raise


async def _transcribe_openai(
    audio_bytes: bytes, filename: str, language: str
) -> str:
    api_key = get_openai_api_key()
    if not api_key:
        raise ValueError(
            "OPENAI hết quota hoặc chưa có key. Đổi TRANSLATOR_PROVIDER=gemini hoặc google trong .env"
        )

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)
    lang = WHISPER_LANG.get(language)

    suffix = ".webm"
    if "." in filename:
        suffix = filename[filename.rfind(".") :]

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as audio_file:
            kwargs: dict = {"model": OPENAI_STT_MODEL, "file": audio_file}
            if lang:
                kwargs["language"] = lang
            try:
                transcript = await client.audio.transcriptions.create(**kwargs)
            except Exception:
                with open(tmp_path, "rb") as fallback_file:
                    fb: dict = {"model": "whisper-1", "file": fallback_file}
                    if lang:
                        fb["language"] = lang
                    transcript = await client.audio.transcriptions.create(**fb)
        return (transcript.text or "").strip()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


async def _transcribe_gemini(
    audio_bytes: bytes, filename: str, language: str
) -> str:
    api_key = get_gemini_api_key()
    if not api_key:
        raise ValueError(
            "Cần GEMINI_API_KEY cho nhận dạng giọng (Google Translate chỉ dịch chữ). "
            "Lấy key: https://aistudio.google.com/apikey"
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
