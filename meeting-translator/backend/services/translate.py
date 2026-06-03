from __future__ import annotations

import asyncio

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


def _lang_name(code: str) -> str:
    return {"vi": "Vietnamese", "ja": "Japanese", "en": "English"}.get(code, code)


async def translate_text(
    text: str,
    source_lang: str,
    target_lang: str,
    provider_override: str | None = None,
) -> str:
    if not text.strip():
        return ""
    if source_lang == target_lang:
        return text

    provider = (provider_override or get_translator_provider()).lower()
    prompt = (
        f"Translate the following from {_lang_name(source_lang)} to {_lang_name(target_lang)}:\n\n{text}"
    )

    if provider == "openai":
        return await _translate_openai(prompt)
    if provider == "gemini":
        return await _translate_gemini(prompt)
    if provider == "google":
        return await _translate_google(text, source_lang, target_lang)

    try:
        return await _translate_openai(prompt)
    except Exception as openai_err:
        msg = str(openai_err).lower()
        if "insufficient_quota" in msg or "billing" in msg or "429" in msg:
            if is_valid_gemini_key(get_gemini_api_key()):
                return await _translate_gemini(prompt)
            return await _translate_google(text, source_lang, target_lang)
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
            "GEMINI_API_KEY không hợp lệ (cần AIza... từ https://aistudio.google.com/apikey). "
            "Không dán key OpenAI sk-proj vào đây."
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
