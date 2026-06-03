from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

_DEFAULT: dict[str, Any] = {
    "recordings_dir": "",
    "export_dir": "",
    "ui_language": "vi",
    "default_source_lang": "auto",
    "default_target_lang": "vi",
    "meeting_pair": "vi-ja",
    "translator_provider": "gemini",
    "session_mode": "transcript",
    "theme": "dark",
}


def _settings_path() -> Path:
    data = os.getenv("MEETING_TRANSLATOR_DATA")
    if data:
        return Path(data) / "settings.json"
    return Path("settings.json")


def load_settings() -> dict[str, Any]:
    path = _settings_path()
    if not path.exists():
        return dict(_DEFAULT)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        merged = dict(_DEFAULT)
        merged.update(data)
        return merged
    except (json.JSONDecodeError, OSError):
        return dict(_DEFAULT)


def reset_settings() -> dict[str, Any]:
    """Ghi đè settings.json bằng giá trị mặc định."""
    merged = dict(_DEFAULT)
    path = _settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    return merged


def save_settings(data: dict[str, Any]) -> dict[str, Any]:
    merged = load_settings()
    for key in _DEFAULT:
        if key in data:
            merged[key] = data[key]
    path = _settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    return merged


def resolve_recordings_dir(fallback: Path) -> Path:
    custom = (load_settings().get("recordings_dir") or "").strip()
    if custom:
        p = Path(custom)
        p.mkdir(parents=True, exist_ok=True)
        return p
    return fallback


def resolve_export_dir(fallback: Path) -> Path:
    custom = (load_settings().get("export_dir") or "").strip()
    if custom:
        p = Path(custom)
        p.mkdir(parents=True, exist_ok=True)
        return p
    return fallback
