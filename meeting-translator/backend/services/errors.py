from __future__ import annotations

import os
import re


def env_file_hint() -> str:
    path = os.getenv("MEETING_TRANSLATOR_ENV")
    if path:
        return path
    data = os.getenv("MEETING_TRANSLATOR_DATA")
    if data:
        return str(__import__("pathlib").Path(data) / ".env")
    return "backend/.env"


def is_placeholder_key(key: str) -> bool:
    if not key or not key.strip():
        return True
    lowered = key.strip().lower()
    placeholders = {
        "sk-...",
        "sk-your",
        "sk-xxxx",
        "xai-...",
        "your-api-key",
        "paste-your-key",
    }
    return any(p in lowered for p in placeholders) or len(key.strip()) < 20


def is_valid_grok_key(key: str) -> bool:
    k = (key or "").strip()
    if is_placeholder_key(k):
        return False
    return k.startswith("xai-") and len(k) >= 24


def is_valid_openai_key(key: str) -> bool:
    k = (key or "").strip()
    if is_placeholder_key(k):
        return False
    return k.startswith("sk-") and len(k) >= 40


def friendly_api_error(exc: Exception, provider_hint: str | None = None) -> str:
    msg = str(exc)
    hint = env_file_hint()
    provider_hint = (provider_hint or "").lower()

    if "invalid_api_key" in msg or "Incorrect API key" in msg or "401" in msg:
        if provider_hint == "grok" or "x.ai" in msg.lower():
            return (
                "XAI_API_KEY không đúng hoặc đã hết hạn. "
                f"Lấy key tại https://console.x.ai — File: {hint}"
            )
        return (
            "OPENAI_API_KEY không đúng hoặc đã hết hạn. "
            f"Sửa file: {hint}"
        )
    lower = msg.lower()
    if "insufficient_quota" in lower or "billing" in lower or "quota" in lower:
        if provider_hint == "grok":
            return (
                "Grok hết quota. Live meeting sẽ tự chuyển ChatGPT nếu có OPENAI_API_KEY. "
                f"Kiểm tra {hint}"
            )
        if provider_hint == "openai" or "openai" in lower:
            return (
                "OpenAI hết quota / chưa bật billing. "
                f"Kiểm tra {hint} — hoặc dùng Google Translate cho dịch văn bản."
            )
        return f"Hết quota API. Kiểm tra key trong {hint}."
    if "model not found" in lower or "invalid argument" in lower:
        if provider_hint == "grok" or "x.ai" in lower:
            return (
                "Model Grok không còn hỗ trợ. Sửa GROK_MODEL=grok-4.3 trong "
                f"{hint} (hoặc xóa dòng GROK_MODEL để dùng mặc định)."
            )
    if "OPENAI_API_KEY" in msg or "XAI_API_KEY" in msg:
        return f"{msg} — File cấu hình: {hint}"

    if len(msg) > 280:
        m = re.search(r"'message':\s*'([^']+)'", msg)
        if m:
            return m.group(1)
        return msg[:280] + "…"
    return msg
