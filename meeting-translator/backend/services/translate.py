from __future__ import annotations

from services.config import OPENAI_TRANSLATE_MODEL, get_openai_api_key

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

    return await _translate_openai(prompt)


async def _translate_openai(prompt: str) -> str:
    api_key = get_openai_api_key()
    if not api_key:
        raise ValueError("OPENAI_API_KEY chưa được cấu hình trong file .env")

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
