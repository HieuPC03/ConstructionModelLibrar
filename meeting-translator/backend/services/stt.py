from __future__ import annotations

import io
import tempfile

from services.config import OPENAI_STT_MODEL, get_openai_api_key

WHISPER_LANG = {"vi": "vi", "ja": "ja", "en": "en", "auto": None}


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "chunk.webm",
    language: str = "auto",
) -> str:
    api_key = get_openai_api_key()
    if not api_key:
        raise ValueError("OPENAI_API_KEY cần thiết (ChatGPT / OpenAI API)")

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
        import os

        try:
            os.unlink(tmp_path)
        except OSError:
            pass
