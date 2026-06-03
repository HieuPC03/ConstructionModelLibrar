from __future__ import annotations

from services.config import (
    GEMINI_API_KEY,
    GEMINI_TRANSLATE_MODEL,
    OPENAI_API_KEY,
    OPENAI_TRANSLATE_MODEL,
    TRANSLATOR_PROVIDER,
)

VI_JA_SYSTEM = """You are a professional Vietnamese–Japanese interpreter for business meetings.
Translate accurately, preserve tone (formal です/ます for Japanese when appropriate), and keep names unchanged.
Output ONLY the translation, no explanations."""


def _lang_name(code: str) -> str:
    return {"vi": "Vietnamese", "ja": "Japanese", "en": "English"}.get(code, code)


async def translate_text(text: str, source_lang: str, target_lang: str) -> str:
    if not text.strip():
        return ""
    if source_lang == target_lang:
        return text

    prompt = (
        f"Translate the following from {_lang_name(source_lang)} to {_lang_name(target_lang)}:\n\n{text}"
    )

    if TRANSLATOR_PROVIDER == "gemini":
        return await _translate_gemini(prompt)
    return await _translate_openai(prompt)


async def _translate_openai(prompt: str) -> str:
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY chưa được cấu hình")

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
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
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY chưa được cấu hình")

    import google.generativeai as genai

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_TRANSLATE_MODEL)
    result = await model.generate_content_async(
        f"{VI_JA_SYSTEM}\n\n{prompt}",
        generation_config={"temperature": 0.2},
    )
    return (result.text or "").strip()
