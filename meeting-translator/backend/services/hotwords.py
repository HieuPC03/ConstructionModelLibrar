"""Hotwords — từ riêng dự án cho Whisper prompt và dịch."""

from __future__ import annotations

import re

from services.settings_store import load_settings

_MAX_PROMPT_CHARS = 120


def parse_hotwords(raw: str | list[str] | None) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        items = raw
    else:
        items = re.split(r"[,、\n;；]+", str(raw))
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        w = item.strip()
        if not w or w in seen:
            continue
        seen.add(w)
        out.append(w)
    return out


def get_user_hotwords() -> list[str]:
    s = load_settings()
    return parse_hotwords(s.get("hotwords"))


def merge_hotwords(*sources: list[str] | None) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for src in sources:
        if not src:
            continue
        for w in src:
            w = w.strip()
            if w and w not in seen:
                seen.add(w)
                out.append(w)
    return out


def build_hotwords_prompt(hotwords: list[str]) -> str:
    if not hotwords:
        return ""
    joined = "、".join(hotwords[:24])
    if len(joined) > _MAX_PROMPT_CHARS:
        joined = joined[:_MAX_PROMPT_CHARS].rsplit("、", 1)[0]
    return f"重要語彙: {joined}。"
