"""Glossary học trong phiên — sửa transcript thủ công."""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class SessionGlossary:
    corrections: dict[str, str] = field(default_factory=dict)
    terms: dict[str, str] = field(default_factory=dict)

    def learn_correction(self, wrong: str, fixed: str) -> None:
        w, f = wrong.strip(), fixed.strip()
        if not w or not f or w == f:
            return
        self.corrections[w] = f
        for token in _extract_terms(f):
            if len(token) >= 2:
                self.terms[token] = f

    def apply_corrections(self, text: str) -> str:
        t = text
        for wrong, fixed in sorted(
            self.corrections.items(), key=lambda x: len(x[0]), reverse=True
        ):
            if wrong in t:
                t = t.replace(wrong, fixed)
        return t

    def hotword_list(self) -> list[str]:
        words = list(self.terms.keys()) + list(self.corrections.values())
        seen: set[str] = set()
        out: list[str] = []
        for w in words:
            w = w.strip()
            if w and w not in seen and len(w) <= 40:
                seen.add(w)
                out.append(w)
        return out[:32]


def _extract_terms(text: str) -> list[str]:
    parts = re.findall(r"[\u3040-\u30ff\u4e00-\u9fffA-Za-zÀ-ỹ0-9]+", text)
    return parts
