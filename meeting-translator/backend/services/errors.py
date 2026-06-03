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
        "your-api-key",
        "paste-your-key",
    }
    return any(p in lowered for p in placeholders) or len(key.strip()) < 20


def friendly_api_error(exc: Exception) -> str:
    msg = str(exc)
    hint = env_file_hint()

    if "invalid_api_key" in msg or "Incorrect API key" in msg or "401" in msg:
        return (
            "API key OpenAI không đúng hoặc đã hết hạn. "
            f"Sửa file: {hint} — dán key mới từ "
            "https://platform.openai.com/api-keys (bấm Create new secret key). "
            "Sau đó khởi động lại app."
        )
    if "insufficient_quota" in msg or "billing" in msg.lower():
        return (
            "Tài khoản OpenAI hết quota / chưa có billing. "
            "Kiểm tra https://platform.openai.com/account/billing"
        )
    if "OPENAI_API_KEY" in msg:
        return f"{msg} — File cấu hình: {hint}"

    if len(msg) > 280:
        m = re.search(r"'message':\s*'([^']+)'", msg)
        if m:
            return m.group(1)
        return msg[:280] + "…"
    return msg
