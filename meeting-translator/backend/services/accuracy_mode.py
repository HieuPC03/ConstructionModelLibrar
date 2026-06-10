"""Chế độ độ chính xác — map high/balanced/fast sang pipeline."""

from __future__ import annotations

from services.settings_store import load_settings

_VALID = frozenset({"high", "balanced", "fast"})


def resolve_accuracy_mode() -> str:
    mode = (load_settings().get("accuracy_mode") or "high").strip().lower()
    return mode if mode in _VALID else "high"


def should_stt_correct() -> bool:
    """LLM sửa STT trước dịch — high + balanced."""
    return resolve_accuracy_mode() in ("high", "balanced")


def should_translate_two_pass() -> bool:
    """Dịch draft → polish — chỉ high."""
    return resolve_accuracy_mode() == "high"
