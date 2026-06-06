"""Pipeline live — nghe audio qua ChatGPT (STT + dịch)."""

from __future__ import annotations

from services.config import OPENAI_STT_MODEL, PROVIDER_LABELS
from services.realtime_buffer import merge_stt_fragments
from services.stt import transcribe_audio
from services.translate import translate_meeting_text

CHATGPT_PROVIDER = PROVIDER_LABELS.get("openai", "ChatGPT (OpenAI)")


async def transcribe_chunk_chatgpt(
    audio_bytes: bytes,
    filename: str,
    language: str,
    capture_mode: str | None = None,
) -> str:
    """STT chunk audio — OpenAI gpt-4o-*-transcribe (ChatGPT)."""
    return await transcribe_audio(
        audio_bytes,
        filename,
        language,
        engine="openai",
        capture_mode=capture_mode,
    )


def merge_caption_chatgpt(accumulated: str, chatgpt_text: str) -> str:
    """Ghép text mới từ ChatGPT vào transcript Live Caption."""
    return merge_stt_fragments(accumulated, chatgpt_text).strip()


async def translate_sentence_chatgpt(
    text: str, source_lang: str, target_lang: str
) -> str:
    """Dịch 1 câu qua ChatGPT — chờ kết quả trước khi đẩy xuống client."""
    if not text.strip() or source_lang == target_lang:
        return ""
    result = await translate_meeting_text(text, source_lang, target_lang)
    return (result.text or "").strip()


def stt_model_label() -> str:
    return f"ChatGPT STT ({OPENAI_STT_MODEL})"
