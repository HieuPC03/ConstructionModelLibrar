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
        "aiza",
    }
    return any(p in lowered for p in placeholders) or len(key.strip()) < 20


def is_valid_gemini_key(key: str) -> bool:
    k = (key or "").strip()
    if is_placeholder_key(k):
        return False
    if k.startswith("sk-"):
        return False
    return k.startswith("AIza") and len(k) >= 35


def is_valid_openai_key(key: str) -> bool:
    k = (key or "").strip()
    if is_placeholder_key(k):
        return False
    return k.startswith("sk-") and len(k) >= 40


def friendly_api_error(exc: Exception) -> str:
    msg = str(exc)
    hint = env_file_hint()

    if (
        "api key not valid" in msg.lower()
        or "API_KEY_INVALID" in msg
        or "invalid api key" in msg.lower()
    ):
        return (
            "GEMINI_API_KEY không hợp lệ. Key Gemini phải bắt đầu bằng AIza... "
            f"(KHÔNG dùng key OpenAI sk-proj). File: {hint} — tạo key tại "
            "https://aistudio.google.com/apikey — hoặc chọn Nhà cung cấp "
            "'Google Translate' và xóa/để trống GEMINI_API_KEY nếu chỉ dịch chữ."
        )
    if "invalid_api_key" in msg or "Incorrect API key" in msg or "401" in msg:
        return (
            "API key OpenAI không đúng hoặc đã hết hạn. "
            f"Sửa file: {hint} — hoặc đổi sang Google Translate trong Cài đặt."
        )
    if "insufficient_quota" in msg or "billing" in msg.lower():
        return (
            "OpenAI hết quota / chưa bật billing (https://platform.openai.com/account/billing). "
            "Trong app: Cài đặt → Nhà cung cấp → chọn Google Gemini hoặc Google Translate, "
            "thêm GEMINI_API_KEY vào .env (Gemini: https://aistudio.google.com/apikey), "
            "khởi động lại app."
        )
    if "OPENAI_API_KEY" in msg:
        return f"{msg} — File cấu hình: {hint}"

    if len(msg) > 280:
        m = re.search(r"'message':\s*'([^']+)'", msg)
        if m:
            return m.group(1)
        return msg[:280] + "…"
    return msg
