from __future__ import annotations

import os
import tempfile

from services.config import OPENAI_STT_MODEL, get_openai_api_key
from services.errors import is_valid_openai_key

WHISPER_LANG = {"vi": "vi", "ja": "ja", "en": "en", "auto": None}
MIN_AUDIO_BYTES = 200


def _audio_suffix_from_bytes(data: bytes, filename: str) -> str:
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


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "chunk.webm",
    language: str = "auto",
    engine: str | None = None,
) -> str:
    if len(audio_bytes) < MIN_AUDIO_BYTES:
        return ""
    if engine == "offline":
        from services.stt_offline import transcribe_offline

        return await transcribe_offline(audio_bytes, filename, language)
    return await _transcribe_openai(audio_bytes, filename, language)


async def _transcribe_openai(
    audio_bytes: bytes, filename: str, language: str
) -> str:
    api_key = get_openai_api_key()
    if not is_valid_openai_key(api_key):
        raise ValueError(
            "OPENAI_API_KEY không hợp lệ hoặc hết quota. Live Caption cần OpenAI Whisper."
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
            try:
                transcript = await client.audio.transcriptions.create(**kwargs)
            except Exception as primary_exc:
                if "invalid file format" in str(primary_exc).lower():
                    return ""
                with open(tmp_path, "rb") as fallback_file:
                    fb: dict = {"model": "whisper-1", "file": fallback_file}
                    if lang:
                        fb["language"] = lang
                    try:
                        transcript = await client.audio.transcriptions.create(**fb)
                    except Exception as fb_exc:
                        if "invalid file format" in str(fb_exc).lower():
                            return ""
                        raise fb_exc from primary_exc
        return (transcript.text or "").strip()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
