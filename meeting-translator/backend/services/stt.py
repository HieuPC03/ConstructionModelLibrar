from __future__ import annotations

import os
import tempfile

from services.config import OPENAI_STT_MODEL, get_openai_api_key
from services.errors import is_valid_openai_key
from services.stt_lang import resolve_stt_language
from services.stt_postprocess import build_whisper_prompt, polish_stt_text

MIN_AUDIO_BYTES = 100


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
    language: str = "ja",
    engine: str | None = None,
    target_lang: str | None = None,
    context_tail: str | None = None,
    capture_mode: str | None = None,
) -> str:
    if len(audio_bytes) < MIN_AUDIO_BYTES:
        return ""
    if engine == "offline":
        from services.stt_offline import transcribe_offline

        return await transcribe_offline(audio_bytes, filename, language)
    return await _transcribe_openai(
        audio_bytes,
        filename,
        language,
        target_lang=target_lang,
        context_tail=context_tail,
        capture_mode=capture_mode,
    )


async def _transcribe_openai(
    audio_bytes: bytes,
    filename: str,
    language: str,
    target_lang: str | None = None,
    context_tail: str | None = None,
    capture_mode: str | None = None,
) -> str:
    api_key = get_openai_api_key()
    if not is_valid_openai_key(api_key):
        raise ValueError(
            "OPENAI_API_KEY không hợp lệ hoặc hết quota. "
            "Live Caption & dịch realtime cần ChatGPT (OpenAI STT)."
        )

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)
    lang, base_prompt = resolve_stt_language(language, target_lang, capture_mode)
    prompt = build_whisper_prompt(base_prompt, context_tail)

    suffix = _audio_suffix_from_bytes(audio_bytes, filename)

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        text = await _run_openai_transcription(
            client, tmp_path, OPENAI_STT_MODEL, lang, prompt
        )
        if not text and lang == "ja":
            text = await _run_openai_transcription(
                client, tmp_path, "whisper-1", lang, prompt
            )
        return polish_stt_text(text, lang or language or "ja")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


async def _run_openai_transcription(
    client,
    path: str,
    model: str,
    lang: str | None,
    prompt: str | None,
) -> str:
    with open(path, "rb") as audio_file:
        kwargs: dict = {"model": model, "file": audio_file, "temperature": 0}
        if lang:
            kwargs["language"] = lang
        if prompt:
            kwargs["prompt"] = prompt
        try:
            transcript = await client.audio.transcriptions.create(**kwargs)
            return (transcript.text or "").strip()
        except Exception as exc:
            if "invalid file format" in str(exc).lower():
                return ""
            raise
