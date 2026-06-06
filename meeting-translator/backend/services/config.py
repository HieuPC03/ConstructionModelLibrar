import os
from pathlib import Path

from dotenv import load_dotenv

from services.settings_store import load_settings, resolve_recordings_dir

_data_root = os.getenv("MEETING_TRANSLATOR_DATA")
_env_file = os.getenv("MEETING_TRANSLATOR_ENV")


def _reload_env() -> None:
    if _env_file:
        load_dotenv(_env_file, override=True)
    elif _data_root:
        load_dotenv(Path(_data_root) / ".env", override=True)
    else:
        load_dotenv(override=True)


def _clean_secret(value: str) -> str:
    v = (value or "").strip()
    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
        v = v[1:-1].strip()
    return v.lstrip("\ufeff")


def get_openai_api_key() -> str:
    _reload_env()
    return _clean_secret(os.getenv("OPENAI_API_KEY", ""))


def get_grok_api_key() -> str:
    _reload_env()
    return _clean_secret(os.getenv("XAI_API_KEY", ""))


def get_translator_provider() -> str:
    _reload_env()
    from_settings = (load_settings().get("translator_provider") or "").strip().lower()
    if from_settings in ("openai", "grok", "google"):
        return from_settings
    env = (os.getenv("TRANSLATOR_PROVIDER") or "grok").strip().lower()
    if env in ("openai", "grok", "google"):
        return env
    return "grok"


_LEGACY_GROK_MODELS = {
    "grok-2-latest": "grok-4.3",
    "grok-2-1212": "grok-4.3",
    "grok-2": "grok-4.3",
    "grok-beta": "grok-4.3",
    "grok-3": "grok-4.3",
    "grok-3-latest": "grok-4.3",
}


def get_grok_model() -> str:
    _reload_env()
    raw = (os.getenv("GROK_MODEL") or "grok-4.3").strip()
    return _LEGACY_GROK_MODELS.get(raw.lower(), raw) or "grok-4.3"


_reload_env()

OPENAI_API_KEY = get_openai_api_key()
OPENAI_STT_MODEL = os.getenv("OPENAI_STT_MODEL", "gpt-4o-mini-transcribe")
OPENAI_TRANSLATE_MODEL = os.getenv("OPENAI_TRANSLATE_MODEL", "gpt-4o-mini")
GROK_API_KEY = get_grok_api_key()
GROK_MODEL = get_grok_model()
GROK_API_BASE = os.getenv("GROK_API_BASE", "https://api.x.ai/v1")
TRANSLATOR_PROVIDER = get_translator_provider()

_default_recordings = (
    Path(_data_root) / "recordings" if _data_root else Path("./recordings")
)
RECORDINGS_DIR = resolve_recordings_dir(
    Path(os.getenv("RECORDINGS_DIR", str(_default_recordings)))
)
RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)

PROVIDER_LABELS = {
    "openai": "ChatGPT (OpenAI)",
    "grok": "Grok (xAI)",
    "google": "Google Translate",
}

LANGUAGE_LABELS = {
    "vi": "Tiếng Việt",
    "ja": "Tiếng Nhật",
    "en": "English",
    "auto": "Tự động",
}
