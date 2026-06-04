from __future__ import annotations

import re

_SUPPORTED = frozenset({"vi", "ja", "en"})


def normalize_lang(code: str | None) -> str | None:
    if not code:
        return None
    c = code.strip().lower().split("-")[0]
    if c in _SUPPORTED:
        return c
    return None


def detect_lang_from_text(text: str) -> str:
    """Heuristic when STT does not return language (auto / mixed meeting)."""
    t = text.strip()
    if not t:
        return "en"

    ja = len(re.findall(r"[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]", t))
    vi_mark = len(
        re.findall(
            r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]",
            t,
            re.I,
        )
    )
    latin = len(re.findall(r"[A-Za-z]", t))
    total = max(len(t), 1)

    if ja / total >= 0.12:
        return "ja"
    if vi_mark >= 2 or re.search(
        r"\b(không|được|này|chúng|mình|anh|chị|em|và|của|trong)\b", t, re.I
    ):
        return "vi"
    if latin / total >= 0.35:
        return "en"
    if ja > 0:
        return "ja"
    return "vi"


def resolve_source_lang(requested: str, detected: str | None, text: str) -> str:
    norm = normalize_lang(requested)
    if norm:
        return norm
    det = normalize_lang(detected)
    if det:
        return det
    return detect_lang_from_text(text)
