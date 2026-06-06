from __future__ import annotations

import re

JA_STT_PROMPT = (
    "以下は日本語のビジネス会議・オンライン通話です。"
    "日本語のみ正確に書き起こす。韓国語・英語・中国語は出力しない。"
    "句読点を適切に付け、話し言葉をそのまま記録する。"
)

VI_STT_PROMPT = "Đây là cuộc họp tiếng Việt. Ghi lại chính xác lời nói."

JA_VI_STT_PROMPT = (
    "日本語とベトナム語の会議です。"
    "日本語はひらがな・カタカナ・漢字で正確に。韓国語・英語は絶対に出力しない。"
    "ベトナム語はそのまま書き起こす。句読点を適切に付ける。"
)

_HANGUL = re.compile(r"[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]+")
# Latin/ASCII đoạn lạ chen giữa tiếng Nhật (Whisper ảo giác)
_LATIN_RUN = re.compile(r"[A-Za-z]{2,}")

_VI_DIACRITIC = re.compile(
    r"[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ"
    r"ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]"
)

_VI_WORD_MARKERS = frozenset(
    {
        "toi",
        "tôi",
        "ban",
        "bạn",
        "khong",
        "không",
        "co",
        "có",
        "la",
        "là",
        "va",
        "và",
        "duoc",
        "được",
        "nay",
        "này",
        "cho",
        "cua",
        "của",
        "voi",
        "với",
        "nhung",
        "nhưng",
        "cam",
        "cảm",
        "on",
        "ơn",
    }
)


def is_vietnamese_text(text: str) -> bool:
    """Nhận diện câu tiếng Việt (có dấu hoặc từ phổ biến)."""
    t = text.strip()
    if not t:
        return False
    if _VI_DIACRITIC.search(t):
        return True
    if re.search(r"[\u3040-\u30ff\u4e00-\u9fff]", t):
        return False
    words = re.findall(r"[a-zA-ZàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀ-ỹ]+", t.lower())
    if len(words) >= 2 and sum(1 for w in words if w in _VI_WORD_MARKERS) >= 2:
        return True
    return False


def should_skip_meeting_translation(
    text: str, source_lang: str, target_lang: str
) -> bool:
    """Đích là tiếng Việt và nghe được tiếng Việt → chỉ hiện transcript, không dịch."""
    if (target_lang or "").strip().lower() != "vi":
        return False
    return is_vietnamese_text(text)


def sanitize_stt_output(text: str, language: str) -> str:
    """Lọc Hàn/ASCII ảo giác chen vào câu Nhật."""
    if not text:
        return text
    t = text.strip()
    lang = (language or "ja").strip().lower()
    has_ja = bool(re.search(r"[\u3040-\u30ff\u4e00-\u9fff]", t))
    if lang != "ja" and not has_ja:
        return t

    t = _HANGUL.sub("", t)
    if has_ja or lang == "ja":

        t = _LATIN_RUN.sub("", t)

    t = re.sub(r"\s{2,}", " ", t)
    t = re.sub(r"\s+([、。．！？,.!?])", r"\1", t)
    t = re.sub(r"([、。．！？,.!?])\s+", r"\1", t)
    t = re.sub(r"[,、]{2,}", "、", t)
    t = re.sub(r"\s*,\s*", "", t)
    return t.strip()


def resolve_stt_language(
    language: str, target_lang: str | None = None
) -> tuple[str | None, str | None]:
    """Chọn mã Whisper + prompt."""
    lang = (language or "ja").strip().lower()
    tgt = (target_lang or "").strip().lower()
    if lang == "ja" and tgt == "vi":
        return "ja", JA_VI_STT_PROMPT
    if lang == "ja":
        return "ja", JA_STT_PROMPT
    if lang == "vi":
        return "vi", VI_STT_PROMPT
    if lang == "en":
        return "en", None
    return "ja", JA_STT_PROMPT


def translation_source_lang(language: str) -> str:
    lang = (language or "ja").strip().lower()
    if lang in ("vi", "ja", "en"):
        return lang
    return "ja"


def filter_stt_hallucination(
    text: str, language: str, target_lang: str | None = None
) -> str:
    """Bỏ đoạn Latin ngắn khi đang ghi tiếng Nhật (Whisper hay ảo giác tiếng Anh)."""
    if not text:
        return text
    if is_vietnamese_text(text):
        return sanitize_stt_output(text, "vi")
    lang = language or "ja"
    t = sanitize_stt_output(text, lang)
    if not t:
        return ""
    if lang != "ja":
        return t
    if re.search(r"[\u3040-\u30ff\u4e00-\u9fff]", t):
        return t
    letters = [c for c in t if c.isalpha()]
    if not letters:
        return t
    ascii_ratio = sum(1 for c in letters if ord(c) < 128) / len(letters)
    if ascii_ratio >= 0.85 and len(t) <= 120:
        return ""
    return t
