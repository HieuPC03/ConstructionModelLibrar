from __future__ import annotations

import asyncio
from dataclasses import dataclass

from services.config import (
    OPENAI_TRANSLATE_MODEL,
    get_openai_api_key,
    get_translator_provider,
)
from services.errors import is_valid_openai_key
from services.stt_lang import should_skip_meeting_translation

VI_JA_SYSTEM = """You are a professional Vietnamese–Japanese interpreter for business meetings.
Translate accurately, preserve tone (formal です/ます for Japanese when appropriate), and keep names unchanged.
Output ONLY the translation, no explanations."""

_GOOGLE_LANG = {"vi": "vi", "ja": "ja", "en": "en"}


@dataclass
class TranslateResult:
    text: str
    provider: str
    notice: str | None = None


def _lang_name(code: str) -> str:
    return {"vi": "Vietnamese", "ja": "Japanese", "en": "English"}.get(code, code)


async def translate_meeting_text(
    text: str,
    source_lang: str,
    target_lang: str,
) -> TranslateResult:
    """Live Caption «Dịch đoạn» + dịch realtime — ChatGPT (OpenAI)."""
    if not text.strip():
        return TranslateResult("", "ChatGPT (OpenAI)", None)
    if source_lang == target_lang:
        return TranslateResult("", "ChatGPT (OpenAI)", None)
    if should_skip_meeting_translation(text, source_lang, target_lang):
        return TranslateResult("", "ChatGPT (OpenAI)", None)

    prompt = (
        f"Translate the following from {_lang_name(source_lang)} to {_lang_name(target_lang)}:\n\n{text}"
    )
    translated = await _translate_openai(prompt)
    return TranslateResult(translated, "ChatGPT (OpenAI)", None)


async def translate_text(
    text: str,
    source_lang: str,
    target_lang: str,
    provider_override: str | None = None,
) -> TranslateResult:
    if not text.strip():
        return TranslateResult("", provider_override or get_translator_provider(), None)
    if source_lang == target_lang:
        return TranslateResult(text, provider_override or get_translator_provider(), None)

    provider = (provider_override or get_translator_provider()).lower()
    if provider == "grok":
        provider = "openai"

    prompt = (
        f"Translate the following from {_lang_name(source_lang)} to {_lang_name(target_lang)}:\n\n{text}"
    )

    if provider == "openai":
        translated = await _translate_openai(prompt)
        return TranslateResult(translated, "ChatGPT (OpenAI)", None)
    if provider == "google":
        translated = await _translate_google(text, source_lang, target_lang)
        return TranslateResult(translated, "Google Translate", None)

    return await translate_meeting_text(text, source_lang, target_lang)


async def _translate_openai(prompt: str) -> str:
    api_key = get_openai_api_key()
    if not is_valid_openai_key(api_key):
        raise ValueError("OPENAI_API_KEY không hợp lệ — kiểm tra file .env")

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)
    response = await client.chat.completions.create(
        model=OPENAI_TRANSLATE_MODEL,
        messages=[
            {"role": "system", "content": VI_JA_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=800,
    )
    return (response.choices[0].message.content or "").strip()


async def _translate_google(text: str, source_lang: str, target_lang: str) -> str:
    src = _GOOGLE_LANG.get(source_lang, source_lang)
    tgt = _GOOGLE_LANG.get(target_lang, target_lang)

    def _run() -> str:
        from deep_translator import GoogleTranslator

        return GoogleTranslator(source=src, target=tgt).translate(text)

    return await asyncio.to_thread(_run)
