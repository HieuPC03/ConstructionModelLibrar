import os
from pathlib import Path

from dotenv import load_dotenv

_data_root = os.getenv("MEETING_TRANSLATOR_DATA")
_env_file = os.getenv("MEETING_TRANSLATOR_ENV")
if _env_file:
    load_dotenv(_env_file)
elif _data_root:
    load_dotenv(Path(_data_root) / ".env")
else:
    load_dotenv()

TRANSLATOR_PROVIDER = os.getenv("TRANSLATOR_PROVIDER", "openai").lower()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_STT_MODEL = os.getenv("OPENAI_STT_MODEL", "whisper-1")
OPENAI_TRANSLATE_MODEL = os.getenv("OPENAI_TRANSLATE_MODEL", "gpt-4o-mini")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_TRANSLATE_MODEL = os.getenv("GEMINI_TRANSLATE_MODEL", "gemini-2.0-flash")
_default_recordings = (
    Path(_data_root) / "recordings" if _data_root else Path("./recordings")
)
RECORDINGS_DIR = Path(os.getenv("RECORDINGS_DIR", str(_default_recordings)))
RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)

LANGUAGE_LABELS = {
    "vi": "Tiếng Việt",
    "ja": "Tiếng Nhật",
    "en": "English",
    "auto": "Tự động",
}
