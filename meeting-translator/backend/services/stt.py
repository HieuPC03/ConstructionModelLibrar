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
from services.errors import is_valid_gemini_key, is_valid_openai_key

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
    engine: str | None = None,
) -> str:
    if engine == "openai":
        return await _transcribe_openai(audio_bytes, filename, language)
    if engine == "gemini":
        return await _transcribe_gemini(audio_bytes, filename, language)
    if engine == "offline":
        from services.stt_offline import transcribe_offline

        return await transcribe_offline(audio_bytes, filename, language)

    provider = get_translator_provider()
    if provider == "gemini":
        return await _transcribe_gemini(audio_bytes, filename, language)
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
            return await _transcribe_gemini(audio_bytes, filename, language)
        raise


async def _transcribe_openai(
    audio_bytes: bytes, filename: str, language: str
) -> str:
    api_key = get_openai_api_key()
    if not is_valid_openai_key(api_key):
        raise ValueError(
            "OPENAI_API_KEY không hợp lệ hoặc hết quota. Chọn Google Translate trong Cài đặt."
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
