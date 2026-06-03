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


def get_gemini_api_key() -> str:
    _reload_env()
    return _clean_secret(os.getenv("GEMINI_API_KEY", ""))


def get_translator_provider() -> str:
    _reload_env()
    from_settings = (load_settings().get("translator_provider") or "").strip().lower()
    if from_settings in ("openai", "gemini", "google"):
        return from_settings
    env = (os.getenv("TRANSLATOR_PROVIDER") or "google").strip().lower()
    if env in ("openai", "gemini", "google"):
        return env
    return "openai"


_reload_env()

OPENAI_API_KEY = get_openai_api_key()
OPENAI_STT_MODEL = os.getenv("OPENAI_STT_MODEL", "gpt-4o-mini-transcribe")
OPENAI_TRANSLATE_MODEL = os.getenv("OPENAI_TRANSLATE_MODEL", "gpt-4o-mini")
GEMINI_API_KEY = get_gemini_api_key()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
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
    "gemini": "Google Gemini",
    "google": "Google Translate",
}

LANGUAGE_LABELS = {
    "vi": "Tiếng Việt",
    "ja": "Tiếng Nhật",
    "en": "English",
    "auto": "Tự động",
}
