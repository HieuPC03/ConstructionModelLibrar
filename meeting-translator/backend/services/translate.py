from __future__ import annotations

import asyncio
from dataclasses import dataclass

from services.config import (
    GEMINI_MODEL,
    OPENAI_TRANSLATE_MODEL,
    get_gemini_api_key,
    get_openai_api_key,
    get_translator_provider,
)
from services.errors import is_valid_gemini_key, is_valid_openai_key

VI_JA_SYSTEM = """You are a professional Vietnamese–Japanese interpreter for business meetings.
Translate accurately, preserve tone (formal です/ます for Japanese when appropriate), and keep names unchanged.
Output ONLY the translation, no explanations."""

_GOOGLE_LANG = {"vi": "vi", "ja": "ja", "en": "en"}

GEMINI_FALLBACK_NOTICE = (
    "Gemini hết quota hoặc tạm thời không khả dụng. "
    "Đã tự chuyển sang Google Translate (miễn phí, không cần API key)."
)


@dataclass
class TranslateResult:
    text: str
    provider: str
    notice: str | None = None


def _lang_name(code: str) -> str:
    return {"vi": "Vietnamese", "ja": "Japanese", "en": "English"}.get(code, code)


def _gemini_should_fallback_to_google(exc: Exception) -> bool:
    """Chỉ fallback khi quota/rate limit/lỗi tạm thời — không che lỗi key sai."""
    msg = str(exc).lower()
    if any(
        p in msg
        for p in (
            "invalid api key",
            "api_key_invalid",
            "api key not valid",
            "permission denied",
            "unauthenticated",
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
            "resource_exhausted",
            "too many requests",
            "limit exceeded",
            "exceeded your",
            "overload",
            "unavailable",
            "503",
            "capacity",
        )
    )


async def _gemini_with_google_fallback(
    prompt: str, text: str, source_lang: str, target_lang: str
) -> TranslateResult:
    try:
        translated = await _translate_gemini(prompt)
        return TranslateResult(translated, "Google Gemini", None)
    except Exception as gemini_err:
        if not _gemini_should_fallback_to_google(gemini_err):
            raise
        try:
            translated = await _translate_google(text, source_lang, target_lang)
            return TranslateResult(translated, "Google Translate", GEMINI_FALLBACK_NOTICE)
        except Exception:
            raise gemini_err


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

    if provider == "openai":
        translated = await _translate_openai(prompt)
        return TranslateResult(translated, "ChatGPT (OpenAI)", None)
    if provider == "gemini":
        return await _gemini_with_google_fallback(prompt, text, source_lang, target_lang)
    if provider == "google":
        translated = await _translate_google(text, source_lang, target_lang)
        return TranslateResult(translated, "Google Translate", None)

    try:
        translated = await _translate_openai(prompt)
        return TranslateResult(translated, "ChatGPT (OpenAI)", None)
    except Exception as openai_err:
        msg = str(openai_err).lower()
        if "insufficient_quota" in msg or "billing" in msg or "429" in msg:
            if is_valid_gemini_key(get_gemini_api_key()):
                try:
                    return await _gemini_with_google_fallback(
                        prompt, text, source_lang, target_lang
                    )
                except Exception:
                    pass
            translated = await _translate_google(text, source_lang, target_lang)
            return TranslateResult(
                translated,
                "Google Translate",
                "OpenAI hết quota. Đã tự chuyển sang Google Translate (miễn phí).",
            )
        raise


async def _translate_openai(prompt: str) -> str:
    api_key = get_openai_api_key()
    if not is_valid_openai_key(api_key):
        raise ValueError("OPENAI_API_KEY không hợp lệ — chọn Google Translate trong Cài đặt")

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


async def _translate_gemini(prompt: str) -> str:
    api_key = get_gemini_api_key()
    if not is_valid_gemini_key(api_key):
        raise ValueError(
            "GEMINI_API_KEY không hợp lệ (AIza... hoặc AQ.... từ https://aistudio.google.com/apikey). "
            "Không dán key OpenAI sk-proj."
        )

    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(GEMINI_MODEL)
    result = await model.generate_content_async(
        f"{VI_JA_SYSTEM}\n\n{prompt}",
        generation_config={"temperature": 0.2},
    )
    return (result.text or "").strip()


async def _translate_google(text: str, source_lang: str, target_lang: str) -> str:
    src = _GOOGLE_LANG.get(source_lang, source_lang)
    tgt = _GOOGLE_LANG.get(target_lang, target_lang)

    def _run() -> str:
        from deep_translator import GoogleTranslator

        return GoogleTranslator(source=src, target=tgt).translate(text)

    return await asyncio.to_thread(_run)
