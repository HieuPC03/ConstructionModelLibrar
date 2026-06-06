"""Tiện ích tiếng Nhật — Janome phân tích hình thái (pure Python, không cần MeCab)."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

try:
    import jaconv
except Exception:
    jaconv = None  # type: ignore

try:
    from janome.tokenizer import Tokenizer

    _TOKENIZER: Tokenizer | None = Tokenizer()
except Exception:
    _TOKENIZER = None

_GLOSSARY_PATH = (
    Path(__file__).resolve().parent.parent / "assets" / "jp_vi_glossary.json"
)
_glossary: dict[str, dict] | None = None

_CJK = re.compile(r"[\u3040-\u30ff\u4e00-\u9fff]")
_SENT_END = re.compile(r"[。．！？.?!…]$")
# STT hay thiếu dấu nhưng đã kết thúc ý (敬語・終助詞)
_CLAUSE_END = re.compile(
    r"(です|ます|でした|ました|ません|でしょう|ください|だね|だよ|じゃない|ではない)"
    r"(?![、。．！？.?!…])"
)


@dataclass
class JaToken:
    surface: str
    reading: str = ""
    base_form: str = ""
    pos: str = ""
    meanings: list[str] = field(default_factory=list)


def _load_glossary() -> dict[str, dict]:
    global _glossary
    if _glossary is not None:
        return _glossary
    if not _GLOSSARY_PATH.is_file():
        _glossary = {}
        return _glossary
    with open(_GLOSSARY_PATH, encoding="utf-8") as f:
        _glossary = json.load(f)
    return _glossary


def _kata_to_hira(reading: str) -> str:
    if not reading:
        return ""
    if jaconv:
        full = jaconv.h2z(reading, kana=True, ascii=False, digit=False)
        return jaconv.kata2hira(full)
    return reading


def has_japanese(text: str) -> bool:
    return bool(_CJK.search(text or ""))


def tokenize_japanese(text: str) -> list[JaToken]:
    """Phân tích từ — surface, đọc hiragana, hán tự, POS, nghĩa (glossary)."""
    t = (text or "").strip()
    if not t or not _TOKENIZER:
        return [JaToken(surface=t)] if t else []

    glossary = _load_glossary()
    result: list[JaToken] = []
    for token in _TOKENIZER.tokenize(t, wakati=False):
        surface = token.surface
        pos_raw = token.part_of_speech.split(",")[0] if token.part_of_speech else ""
        reading = _kata_to_hira(getattr(token, "reading", "") or "")
        base = getattr(token, "base_form", surface) or surface
        if base == "*":
            base = surface

        entry = glossary.get(surface) or glossary.get(base)
        meanings = list(entry.get("meanings", [])) if entry else []
        if entry and entry.get("reading"):
            reading = reading or entry["reading"]

        result.append(
            JaToken(
                surface=surface,
                reading=reading,
                base_form=base,
                pos=pos_raw,
                meanings=meanings,
            )
        )
    return result


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
