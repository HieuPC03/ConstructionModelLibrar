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

VI_JA_SYSTEM = """You are a professional Japanese–Vietnamese interpreter for live business meetings.

Rules:
- Input is speech-to-text and may contain errors or stray Korean/English noise — infer the intended Japanese meaning.
- Output natural, grammatically correct Vietnamese with appropriate politeness.
- Translate complete thoughts, not word-by-word fragments.
- Preserve proper names and technical terms.
- Output ONLY the translation, no notes or explanations."""

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
    prior_context: str | None = None,
) -> TranslateResult:
    """Live Caption «Dịch đoạn» + dịch realtime — ChatGPT (OpenAI)."""
    if not text.strip():
        return TranslateResult("", "ChatGPT (OpenAI)", None)
    if source_lang == target_lang:
        return TranslateResult("", "ChatGPT (OpenAI)", None)
    if should_skip_meeting_translation(text, source_lang, target_lang):
        return TranslateResult("", "ChatGPT (OpenAI)", None)

    ctx_block = ""
    if prior_context and prior_context.strip():
        ctx_block = (
            f"Previous utterance (for discourse context only, do not re-translate):\n"
            f"{prior_context.strip()[-400:]}\n\n"
        )
    prompt = (
        f"{ctx_block}"
        f"Translate this complete utterance from {_lang_name(source_lang)} "
        f"to {_lang_name(target_lang)}.\n"
        f"- Fix STT errors and infer the speaker's intended meaning.\n"
        f"- Use natural grammar and appropriate politeness.\n\n"
        f"{text}"
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
        temperature=0.1,
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
