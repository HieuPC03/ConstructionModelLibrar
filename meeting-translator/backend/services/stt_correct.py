"""Sửa lỗi STT bằng LLM trước khi dịch."""

from __future__ import annotations

from services.config import OPENAI_TRANSLATE_MODEL, get_openai_api_key
from services.errors import is_valid_openai_key

_CORRECT_SYSTEM = """You fix Japanese or Vietnamese speech-to-text errors for business meetings.
Return ONLY the corrected sentence — same language, natural grammar, no explanation."""


async def correct_stt_text(text: str, language: str) -> str:
    t = (text or "").strip()
    if not t or len(t) < 4:
        return t
    lang = (language or "ja").strip().lower()
    if lang not in ("ja", "vi"):
        return t

    api_key = get_openai_api_key()
    if not is_valid_openai_key(api_key):
        return t

    lang_name = "Japanese" if lang == "ja" else "Vietnamese"
    prompt = (
        f"Fix STT errors in this {lang_name} meeting utterance. "
        f"Preserve meaning and proper nouns.\n\n{t}"
    )

    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=api_key)
        response = await client.chat.completions.create(
            model=OPENAI_TRANSLATE_MODEL,
            messages=[
                {"role": "system", "content": _CORRECT_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0,
            max_tokens=400,
        )
        fixed = (response.choices[0].message.content or "").strip()
        return fixed if fixed and len(fixed) >= max(4, len(t) // 3) else t
    except Exception:
        return t
