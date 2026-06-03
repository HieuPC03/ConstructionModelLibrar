from __future__ import annotations

from services.settings_store import load_settings

SESSION_TRANSLATE = "translate_realtime"
SESSION_TRANSCRIPT = "transcript"


def get_session_mode(override: str | None = None) -> str:
    if override in (SESSION_TRANSLATE, SESSION_TRANSCRIPT):
        return override
    mode = (load_settings().get("session_mode") or SESSION_TRANSCRIPT).strip()
    if mode in (SESSION_TRANSLATE, SESSION_TRANSCRIPT):
        return mode
    return SESSION_TRANSCRIPT


def stt_engine_for_mode(mode: str) -> str:
    return "openai" if mode == SESSION_TRANSLATE else "gemini"


def text_translate_provider_for_mode(mode: str) -> str:
    """Transcript mode → Gemini; realtime ChatGPT mode → OpenAI."""
    if mode == SESSION_TRANSCRIPT:
        return "gemini"
    return "openai"


def resolve_text_translate_provider(
    session_mode: str | None = None,
    request_mode: str | None = None,
) -> str:
    """Pick provider for POST /api/translate/text (request body wins over saved settings)."""
    mode = get_session_mode(request_mode or session_mode)
    return text_translate_provider_for_mode(mode)
