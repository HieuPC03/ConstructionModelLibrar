from __future__ import annotations

import re

JA_STT_PROMPT = (
    "以下は日本語の会議・オンライン通話の音声です。"
    "話し言葉をひらがな・カタカナ・漢字で正確に書き起こしてください。"
)

VI_STT_PROMPT = "Đây là cuộc họp tiếng Việt. Ghi lại chính xác lời nói."


def resolve_stt_language(language: str) -> tuple[str | None, str | None]:
    """Chọn mã Whisper + prompt. Không dùng auto — tránh nhận nhầm tiếng Anh."""
    lang = (language or "ja").strip().lower()
    if lang == "ja":
        return "ja", JA_STT_PROMPT
    if lang == "vi":
        return "vi", VI_STT_PROMPT
    if lang == "en":
        return "en", None
    return "ja", JA_STT_PROMPT


def translation_source_lang(language: str) -> str:
    lang = (language or "ja").strip().lower()
    if lang in ("vi", "ja", "en"):
        return lang
    return "ja"


def filter_stt_hallucination(text: str, language: str) -> str:
    """Bỏ đoạn Latin ngắn khi đang ghi tiếng Nhật (Whisper hay ảo giác tiếng Anh)."""
    if not text or language != "ja":
        return text
    t = text.strip()
    if re.search(r"[\u3040-\u30ff\u4e00-\u9fff]", t):
        return text
    letters = [c for c in t if c.isalpha()]
    if not letters:
        return text
    ascii_ratio = sum(1 for c in letters if ord(c) < 128) / len(letters)
    if ascii_ratio >= 0.85 and len(t) <= 120:
        return ""
    return text
