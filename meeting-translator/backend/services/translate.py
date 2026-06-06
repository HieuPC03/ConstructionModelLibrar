from __future__ import annotations

import asyncio
from dataclasses import dataclass

from services.config import (
    GROK_API_BASE,
    GROK_MODEL,
    OPENAI_TRANSLATE_MODEL,
    get_grok_api_key,
    get_openai_api_key,
    get_translator_provider,
)
from services.errors import is_valid_grok_key, is_valid_openai_key

VI_JA_SYSTEM = """You are a professional Vietnamese–Japanese interpreter for business meetings.
Translate accurately, preserve tone (formal です/ます for Japanese when appropriate), and keep names unchanged.
Output ONLY the translation, no explanations."""

_GOOGLE_LANG = {"vi": "vi", "ja": "ja", "en": "en"}

GROK_FALLBACK_NOTICE = (
    "Grok hết quota hoặc tạm thời không khả dụng. "
    "Đã tự chuyển sang ChatGPT (OpenAI)."
)


@dataclass
class TranslateResult:
    text: str
    provider: str
    notice: str | None = None


def _lang_name(code: str) -> str:
    return {"vi": "Vietnamese", "ja": "Japanese", "en": "English"}.get(code, code)


def _should_fallback_to_openai(exc: Exception) -> bool:
    msg = str(exc).lower()
    if any(
        p in msg
        for p in (
            "invalid api key",
            "api_key_invalid",
            "api key not valid",
            "permission denied",
            "unauthenticated",
            "incorrect api key",
        )
    ):
        return False
    return any(
        p in msg
        for p in (
            "quota",
            "billing",
            "429",
            "rate limit",
            "ratelimit",
            "resource exhausted",
            "too many requests",
            "limit exceeded",
            "exceeded your",
            "overload",
            "unavailable",
            "503",
            "capacity",
            "insufficient",
        )
    )


async def translate_meeting_text(
    text: str,
    source_lang: str,
    target_lang: str,
) -> TranslateResult:
    """Live Caption «Dịch đoạn» + dịch realtime: Grok trước, ChatGPT khi hết quota."""
    if not text.strip():
        return TranslateResult("", "Grok (xAI)", None)
    if source_lang == target_lang:
        return TranslateResult(text, "Grok (xAI)", None)

    prompt = (
        f"Translate the following from {_lang_name(source_lang)} to {_lang_name(target_lang)}:\n\n{text}"
    )

    if is_valid_grok_key(get_grok_api_key()):
        try:
            translated = await _translate_grok(prompt)
            return TranslateResult(translated, "Grok (xAI)", None)
        except Exception as grok_err:
            if not _should_fallback_to_openai(grok_err):
                raise

    translated = await _translate_openai(prompt)
    notice = GROK_FALLBACK_NOTICE if is_valid_grok_key(get_grok_api_key()) else None
    return TranslateResult(translated, "ChatGPT (OpenAI)", notice)


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
    prompt = (
        f"Translate the following from {_lang_name(source_lang)} to {_lang_name(target_lang)}:\n\n{text}"
    )

    if provider == "grok":
        if not is_valid_grok_key(get_grok_api_key()):
            raise ValueError(
                "XAI_API_KEY không hợp lệ — lấy tại https://console.x.ai"
            )
        translated = await _translate_grok(prompt)
        return TranslateResult(translated, "Grok (xAI)", None)
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
    )
    return (response.choices[0].message.content or "").strip()


async def _translate_grok(prompt: str) -> str:
    api_key = get_grok_api_key()
    if not is_valid_grok_key(api_key):
        raise ValueError(
            "XAI_API_KEY không hợp lệ — lấy tại https://console.x.ai (dạng xai-...)"
        )

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key, base_url=GROK_API_BASE)
    response = await client.chat.completions.create(
        model=GROK_MODEL,
        messages=[
            {"role": "system", "content": VI_JA_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )
    return (response.choices[0].message.content or "").strip()


async def _translate_google(text: str, source_lang: str, target_lang: str) -> str:
    src = _GOOGLE_LANG.get(source_lang, source_lang)
    tgt = _GOOGLE_LANG.get(target_lang, target_lang)

    def _run() -> str:
        from deep_translator import GoogleTranslator

        return GoogleTranslator(source=src, target=tgt).translate(text)

    return await asyncio.to_thread(_run)
