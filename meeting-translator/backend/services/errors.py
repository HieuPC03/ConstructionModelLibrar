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
    """Google AI Studio: AIza... (cũ) hoặc AQ.... (key mới 2024+)."""
    k = (key or "").strip()
    if is_placeholder_key(k):
        return False
    if k.startswith("sk-"):
        return False
    if len(k) < 20:
        return False
    if k.startswith("AIza"):
        return True
    if k.startswith("AQ."):
        return True
    return bool(re.match(r"^AQ[A-Za-z0-9._-]{15,}$", k))


def is_valid_openai_key(key: str) -> bool:
    k = (key or "").strip()
    if is_placeholder_key(k):
        return False
    return k.startswith("sk-") and len(k) >= 40


def friendly_api_error(exc: Exception, provider_hint: str | None = None) -> str:
    msg = str(exc)
    hint = env_file_hint()
    provider_hint = (provider_hint or "").lower()

    if (
        "api key not valid" in msg.lower()
        or "API_KEY_INVALID" in msg
        or "invalid api key" in msg.lower()
    ):
        return (
            "GEMINI_API_KEY không hợp lệ hoặc đã revoke. Key từ "
            "https://aistudio.google.com/apikey (dạng AIza... hoặc AQ....). "
            f"KHÔNG dùng key OpenAI sk-proj. File: {hint} — "
            "https://aistudio.google.com/apikey — hoặc chọn Nhà cung cấp "
            "'Google Translate' và xóa/để trống GEMINI_API_KEY nếu chỉ dịch chữ."
        )
    if "invalid_api_key" in msg or "Incorrect API key" in msg or "401" in msg:
        return (
            "API key OpenAI không đúng hoặc đã hết hạn. "
            f"Sửa file: {hint} — hoặc đổi sang Google Translate trong Cài đặt."
        )
    lower = msg.lower()
    if "insufficient_quota" in lower or "billing" in lower:
        if "openai" in lower or "sk-proj" in lower or provider_hint == "openai":
            return (
                "OpenAI hết quota / chưa bật billing (https://platform.openai.com/account/billing). "
                "Chọn chế độ «Ghi transcript (Gemini)» để dịch văn bản bằng Gemini, "
                "hoặc thêm GEMINI_API_KEY vào .env (https://aistudio.google.com/apikey)."
            )
        if "gemini" in lower or "generative" in lower or "google" in lower:
            return (
                "Gemini/Google hết quota hoặc tạm thời không dùng được. "
                f"Kiểm tra GEMINI_API_KEY trong {hint} — "
                "https://aistudio.google.com/apikey — hoặc thử lại sau."
            )
        return (
            "Hết quota API. Dịch văn bản: chọn «Ghi transcript (Gemini)», "
            f"thêm GEMINI_API_KEY vào {hint} (https://aistudio.google.com/apikey), "
            "khởi động lại app. (Không cần OpenAI billing.)"
        )
    if "OPENAI_API_KEY" in msg:
        return f"{msg} — File cấu hình: {hint}"

    if len(msg) > 280:
        m = re.search(r"'message':\s*'([^']+)'", msg)
        if m:
            return m.group(1)
        return msg[:280] + "…"
    return msg
