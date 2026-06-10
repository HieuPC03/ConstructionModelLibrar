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
    t = normalize_japanese_text(text)
    t = insert_missing_sentence_periods(t)
    t = dedupe_morpheme_loops(t)
    return t.strip()


_KANJI_NUM = {
    "〇": 0,
    "零": 0,
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
}
_KANJI_UNIT = {"十": 10, "百": 100, "千": 1000, "万": 10000}


def _kanji_digits_to_int(s: str) -> int | None:
    if not s:
        return None
    total = 0
    current = 0
    num = 0
    for ch in s:
        if ch in _KANJI_NUM:
            num = _KANJI_NUM[ch]
        elif ch in _KANJI_UNIT:
            unit = _KANJI_UNIT[ch]
            if unit == 10000:
                total = (total + (current or num or 1)) * unit
                current = 0
                num = 0
            else:
                current += (num or 1) * unit
                num = 0
        else:
            return None
    return total + current + num


def normalize_japanese_numbers(text: str) -> str:
    """Chuẩn hóa số Kanji → Arabic (三百→300)."""
    if not has_japanese(text):
        return text

    def repl(m: re.Match[str]) -> str:
        val = _kanji_digits_to_int(m.group(0))
        return str(val) if val is not None else m.group(0)

    t = re.sub(r"[〇零一二三四五六七八九十百千万]+", repl, text)
    return t


_WEEKDAY_MAP = {
    "月曜日": "Thứ Hai",
    "火曜日": "Thứ Ba",
    "水曜日": "Thứ Tư",
    "木曜日": "Thứ Năm",
    "金曜日": "Thứ Sáu",
    "土曜日": "Thứ Bảy",
    "日曜日": "Chủ nhật",
}


def normalize_japanese_dates(text: str) -> str:
    """Giữ ngày tháng rõ ràng — 来週の火曜日 giữ nguyên nhưng chuẩn hóa khoảng trắng."""
    t = text
    t = re.sub(r"(\d{4})年(\d{1,2})月(\d{1,2})日", r"\1-\2-\3", t)
    t = re.sub(r"(\d{1,2})月(\d{1,2})日", r"\1/\2", t)
    return t


def normalize_japanese_text(text: str) -> str:
    """Pipeline chuẩn hóa số, ngày, khoảng trắng."""
    if not text:
        return text
    t = normalize_japanese_spacing(text)
    t = normalize_japanese_numbers(t)
    t = normalize_japanese_dates(t)
    return t


def build_morpheme_breakdown(text: str) -> str:
    """Chuỗi morpheme cho prompt dịch: 会議（かいぎ）/の/進捗（しんちょく）."""
    tokens = tokenize_japanese(text)
    if not tokens:
        return ""
    parts: list[str] = []
    for tok in tokens:
        if not tok.surface.strip():
            continue
        if tok.reading and re.search(r"[\u4e00-\u9fff]", tok.surface):
            parts.append(f"{tok.surface}（{tok.reading}）")
        else:
            parts.append(tok.surface)
    return "/".join(parts)


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
