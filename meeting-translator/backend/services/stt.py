from __future__ import annotations

import io
import tempfile

from services.config import OPENAI_API_KEY, OPENAI_STT_MODEL

WHISPER_LANG = {"vi": "vi", "ja": "ja", "en": "en", "auto": None}


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "chunk.webm",
    language: str = "auto",
) -> str:
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY cần thiết cho nhận dạng giọng nói (Whisper)")

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    lang = WHISPER_LANG.get(language)

    suffix = ".webm"
    if "." in filename:
        suffix = filename[filename.rfind(".") :]

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as audio_file:
            kwargs = {"model": OPENAI_STT_MODEL, "file": audio_file}
            if lang:
                kwargs["language"] = lang
            transcript = await client.audio.transcriptions.create(**kwargs)
        return (transcript.text or "").strip()
    finally:
        import os

        try:
            os.unlink(tmp_path)
        except OSError:
            pass
