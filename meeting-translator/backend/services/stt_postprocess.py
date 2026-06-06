"""Hậu xử lý STT — lọc ảo giác, ghép câu, chuẩn hóa."""

from __future__ import annotations

import re

from services.stt_lang import sanitize_stt_output

SENTENCE_END = ".?!。．？！…"

# Whisper hay ảo giác khi im lặng / nhiễu
_HALLUCINATION_PHRASES = (
    "ご視聴ありがとうございました",
    "ご視聴ありがとうございます",
    "ご清聴ありがとうございました",
    "字幕はごぜひご覧ください",
    "字幕提供",
    "thank you for watching",
    "thanks for watching",
    "subtitles by",
    "请不吝点赞",
    "チャンネル登録",
    "おやすみなさい",
    "では、また",
)

_HALLUCINATION_ONLY = re.compile(
    r"^[\s、。．！？,.!?…]*("
    + "|".join(re.escape(p) for p in _HALLUCINATION_PHRASES)
    + r")[\s、。．！？,.!?…]*$",
    re.IGNORECASE,
)


def build_whisper_prompt(base: str, tail: str | None) -> str:
    """Ghép ngữ cảnh đuôi transcript vào prompt Whisper (liên tục câu)."""
    ctx = (tail or "").strip()
    if not ctx:
        return base
    return f"{base} {ctx[-220:]}"


def dedupe_stt_repetition(text: str) -> str:
    """Bỏ câu/cụm lặp liên tiếp do STT chồng chunk."""
    t = text.strip()
    if not t:
        return t

    parts = re.split(r"([。．！？.?!…])", t)
    sentences: list[str] = []
    buf = ""
    for i, part in enumerate(parts):
        buf += part
        if part in SENTENCE_END or i == len(parts) - 1:
            sent = buf.strip()
            buf = ""
            if not sent:
                continue
            if sentences and sentences[-1] == sent:
                continue
            sentences.append(sent)

    if sentences:
        return "".join(sentences) if any(s.endswith("。") or s.endswith(".") for s in sentences) else " ".join(sentences)

    # Không tách được câu — bỏ lặp đuôi/đầu trong cùng chuỗi
    half = len(t) // 2
    for size in range(min(half, 60), 6, -1):
        if t[:size] == t[size : size * 2]:
            return t[:size] + t[size * 2 :].strip()
    return t


def is_hallucination_only(text: str) -> bool:
    t = text.strip()
    if not t or len(t) > 80:
        return False
    low = t.lower()
    if _HALLUCINATION_ONLY.match(low):
        return True
    for phrase in _HALLUCINATION_PHRASES:
        if low == phrase.lower() or low.replace("。", "") == phrase.lower():
            return True
    return False


def normalize_japanese_punctuation(text: str) -> str:
    t = text
    t = t.replace("｡", "。").replace("､", "、")
    t = re.sub(r"\.{3,}", "…", t)
    t = re.sub(r"…{2,}", "…", t)
    return t


def polish_stt_text(text: str, language: str) -> str:
    """Pipeline hậu xử lý STT trước khi hiển thị/dịch."""
    if not text or not text.strip():
        return ""
    t = sanitize_stt_output(text, language)
    if not t or is_hallucination_only(t):
        return ""
    t = normalize_japanese_punctuation(t)
    t = dedupe_stt_repetition(t)
    return t.strip()


def stt_context_tail(text: str, max_len: int = 240) -> str:
    """Đuôi transcript làm ngữ cảnh cho chunk STT tiếp theo."""
    t = text.strip()
    if not t:
        return ""
    return t[-max_len:]
