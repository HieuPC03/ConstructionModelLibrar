"""Tiện ích tiếng Nhật — Janome phân tích hình thái (pure Python, không cần MeCab)."""

from __future__ import annotations

import re

try:
    from janome.tokenizer import Tokenizer

    _TOKENIZER: Tokenizer | None = Tokenizer()
except Exception:
    _TOKENIZER = None

_CJK = re.compile(r"[\u3040-\u30ff\u4e00-\u9fff]")
_SENT_END = re.compile(r"[。．！？.?!…]$")
# STT hay thiếu dấu nhưng đã kết thúc ý (敬語・終助詞)
_CLAUSE_END = re.compile(
    r"(です|ます|でした|ました|ません|でしょう|ください|だね|だよ|じゃない|ではない)"
    r"(?![、。．！？.?!…])"
)


def has_japanese(text: str) -> bool:
    return bool(_CJK.search(text or ""))


def normalize_japanese_spacing(text: str) -> str:
    """Bỏ khoảng trắng thừa giữa ký tự CJK."""
    if not text:
        return text
    t = text.strip()
    t = re.sub(
        r"([\u3040-\u30ff\u4e00-\u9fff])\s+([\u3040-\u30ff\u4e00-\u9fff])",
        r"\1\2",
        t,
    )
    t = re.sub(r"\s+([、。．！？])", r"\1", t)
    t = re.sub(r"([、。．！？])\s+", r"\1", t)
    return t


def insert_missing_sentence_periods(text: str) -> str:
    """Thêm 。 sau cụm kết thúc câu khi Whisper thiếu dấu."""
    if not has_japanese(text):
        return text
    t = text.strip()
    if _SENT_END.search(t):
        return t
    return _CLAUSE_END.sub(r"\1。", t)


def dedupe_morpheme_loops(text: str) -> str:
    """Bỏ lặp morpheme liên tiếp (Janome) — ví dụ ですです → です."""
    if not _TOKENIZER or not has_japanese(text) or len(text) < 8:
        return text

    surfaces = list(_TOKENIZER.tokenize(text, wakati=True))
    if len(surfaces) < 2:
        return text

    deduped: list[str] = []
    for surf in surfaces:
        if not deduped or surf != deduped[-1]:
            deduped.append(surf)

    if len(deduped) == len(surfaces):
        return text

    return "".join(deduped)


def polish_japanese_stt(text: str) -> str:
    """Chuẩn hóa transcript tiếng Nhật trước hiển thị/dịch."""
    if not text or not has_japanese(text):
        return text
    t = normalize_japanese_spacing(text)
    t = insert_missing_sentence_periods(t)
    t = dedupe_morpheme_loops(t)
    return t.strip()


def split_japanese_sentences(text: str) -> list[str]:
    """Tách câu tiếng Nhật — ưu tiên dấu câu, fallback Janome."""
    t = text.strip()
    if not t:
        return []

    parts = re.split(r"(?<=[。．！？.?!…])", t)
    sentences = [p.strip() for p in parts if p.strip()]
    if len(sentences) > 1:
        return sentences

    if not _TOKENIZER:
        return [t] if t else []

    buf = ""
    result: list[str] = []
    for token in _TOKENIZER.tokenize(t, wakati=False):
        buf += token.surface
        pos = token.part_of_speech.split(",")[0]
        if pos in ("助動詞", "終助詞", "感動詞") and len(buf) >= 6:
            result.append(buf.strip())
            buf = ""
    if buf.strip():
        result.append(buf.strip())
    return result if result else ([t] if t else [])
