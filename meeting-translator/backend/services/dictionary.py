"""Từ điển JP↔VI — Janome (đọc/hán tự) + glossary + Google fallback."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from services.ja_text import build_morpheme_breakdown, has_japanese, tokenize_japanese
from services.hotwords import merge_hotwords

_ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
_glossary_cache: dict[str, dict] | None = None

_POS_VI = {
    "名詞": "danh từ",
    "動詞": "động từ",
    "形容詞": "tính từ",
    "副詞": "trạng từ",
    "助詞": "trợ từ",
    "助動詞": "trợ động từ",
    "接続詞": "liên từ",
    "感動詞": "thán từ",
    "記号": "ký hiệu",
    "接頭詞": "tiền tố",
    "接尾詞": "hậu tố",
    "連体詞": "tính từ định",
}


@dataclass
class DictToken:
    surface: str
    reading: str = ""
    base_form: str = ""
    pos: str = ""
    meanings: list[str] = field(default_factory=list)


@dataclass
class LookupResult:
    query: str
    word: str
    reading: str = ""
    kanji: str = ""
    pos: str = ""
    meanings: list[str] = field(default_factory=list)
    tokens: list[DictToken] = field(default_factory=list)
    source: str = "janome"


def _load_glossary() -> dict[str, dict]:
    global _glossary_cache
    if _glossary_cache is not None:
        return _glossary_cache
    merged: dict[str, dict] = {}
    if _ASSETS_DIR.is_dir():
        for path in sorted(_ASSETS_DIR.glob("*.json")):
            try:
                with open(path, encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    merged.update(data)
            except (json.JSONDecodeError, OSError):
                continue
    _glossary_cache = merged
    return _glossary_cache


def _pos_label(pos_raw: str) -> str:
    head = (pos_raw or "").split(",")[0].strip()
    return _POS_VI.get(head, head)


def _find_glossary_entry(word: str) -> dict | None:
    glossary = _load_glossary()
    w = word.strip()
    if not w:
        return None
    if w in glossary:
        return glossary[w]
    for key, entry in glossary.items():
        if key in w or w in key:
            return entry
    return None


def _kanji_from_surface(surface: str) -> str:
    chars = [c for c in surface if re.match(r"[\u4e00-\u9fff]", c)]
    return "".join(chars) if chars else surface


async def _translate_word_gloss(
    word: str, source_lang: str, target_lang: str
) -> list[str]:
    if not word.strip():
        return []
    try:
        from services.translate import translate_text

        result = await translate_text(
            word.strip(),
            source_lang,
            target_lang,
            provider_override="google",
        )
        text = (result.text or "").strip()
        return [text] if text else []
    except Exception:
        return []


def build_translation_glossary_hints(
    text: str,
    source_lang: str,
    target_lang: str,
    max_terms: int = 12,
    extra_hotwords: list[str] | None = None,
) -> str:
    """Gợi ý từ điển cho prompt dịch — morpheme + hán tự + đọc + nghĩa."""
    if (source_lang or "").strip().lower() != "ja" or not has_japanese(text):
        return ""

    blocks: list[str] = []
    breakdown = build_morpheme_breakdown(text)
    if breakdown:
        blocks.append(f"Morpheme breakdown: {breakdown}")

    tokens = tokenize_japanese(text)
    hints: list[str] = []
    seen: set[str] = set()

    for tok in tokens:
        key = tok.surface.strip()
        if not key or key in seen:
            continue
        if len(key) < 2 and not re.search(r"[\u4e00-\u9fff]", key):
            continue
        seen.add(key)

        entry = _find_glossary_entry(key) or _find_glossary_entry(tok.base_form)
        reading = tok.reading or (entry or {}).get("reading", "")
        meanings = list(tok.meanings) or list((entry or {}).get("meanings", []))
        if reading or meanings:
            meaning_part = ", ".join(meanings[:3]) if meanings else ""
            if reading and meaning_part:
                hints.append(f"{key}（{reading}）: {meaning_part}")
            elif reading:
                hints.append(f"{key}（{reading}）")
            elif meaning_part:
                hints.append(f"{key}: {meaning_part}")
        if len(hints) >= max_terms:
            break

    if hints:
        blocks.append("Term glossary:\n" + "\n".join(hints))

    hw = merge_hotwords(extra_hotwords or [])
    if hw:
        blocks.append("Project hotwords: " + "、".join(hw[:16]))

    if not blocks:
        return ""
    return "\n".join(blocks) + "\n\n"


async def lookup_word(
    word: str,
    source_lang: str = "ja",
    target_lang: str = "vi",
    context: str | None = None,
) -> LookupResult:
    """Tra từ — Janome đọc/hán tự + glossary + Google."""
    query = (word or "").strip()
    if not query:
        return LookupResult(query="", word="")

    src = (source_lang or "ja").strip().lower()
    tgt = (target_lang or "vi").strip().lower()

    if src == "ja" or has_japanese(query):
        return await _lookup_japanese(query, tgt, context)

    meanings = await _translate_word_gloss(query, src, tgt)
    return LookupResult(
        query=query,
        word=query,
        meanings=meanings,
        source="google" if meanings else "none",
    )


async def _lookup_japanese(
    query: str, target_lang: str, context: str | None
) -> LookupResult:
    tokens = tokenize_japanese(query)
    dict_tokens = [
        DictToken(
            surface=t.surface,
            reading=t.reading,
            base_form=t.base_form,
            pos=t.pos,
            meanings=list(t.meanings),
        )
        for t in tokens
    ]

    entry = _find_glossary_entry(query)
    reading = ""
    meanings: list[str] = []
    pos = ""
    kanji = _kanji_from_surface(query)

    if entry:
        reading = entry.get("reading", "")
        meanings = list(entry.get("meanings", []))
        pos = entry.get("pos", "")

    if tokens:
        if not reading and tokens[0].reading:
            reading = tokens[0].reading
        if not pos and tokens[0].pos:
            pos = _pos_label(tokens[0].pos)
        if not meanings and tokens[0].meanings:
            meanings = list(tokens[0].meanings)

    if not meanings:
        lookup_surface = tokens[0].base_form if tokens else query
        alt = _find_glossary_entry(lookup_surface)
        if alt:
            reading = reading or alt.get("reading", "")
            meanings = list(alt.get("meanings", []))
            pos = pos or alt.get("pos", "")

    if not meanings:
        meanings = await _translate_word_gloss(query, "ja", target_lang)

    source = "glossary" if entry else ("janome" if tokens else "google")
    if not meanings:
        source = "none"

    return LookupResult(
        query=query,
        word=query,
        reading=reading,
        kanji=kanji,
        pos=pos,
        meanings=meanings,
        tokens=dict_tokens,
        source=source,
    )


def tokenize_for_display(text: str) -> list[dict[str, str]]:
    """Token hóa tiếng Nhật để UI highlight (tùy chọn)."""
    return [
        {
            "surface": t.surface,
            "reading": t.reading,
            "pos": t.pos,
            "meanings": ", ".join(t.meanings[:2]),
        }
        for t in tokenize_japanese(text)
        if t.surface.strip()
    ]
