import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

TRANSLATOR_PROVIDER = os.getenv("TRANSLATOR_PROVIDER", "openai").lower()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_STT_MODEL = os.getenv("OPENAI_STT_MODEL", "whisper-1")
OPENAI_TRANSLATE_MODEL = os.getenv("OPENAI_TRANSLATE_MODEL", "gpt-4o-mini")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_TRANSLATE_MODEL = os.getenv("GEMINI_TRANSLATE_MODEL", "gemini-2.0-flash")
RECORDINGS_DIR = Path(os.getenv("RECORDINGS_DIR", "./recordings"))
RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)

LANGUAGE_LABELS = {
    "vi": "Tiếng Việt",
    "ja": "Tiếng Nhật",
    "en": "English",
    "auto": "Tự động",
}
