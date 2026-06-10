"""Hậu xử lý STT — lọc ảo giác, ghép câu, chuẩn hóa."""

from __future__ import annotations

import re

from services.ja_text import polish_japanese_stt
from services.realtime_buffer import merge_stt_fragments
from services.stt_lang import sanitize_stt_output

SENTENCE_END = ".?!。．？！…"
# Prompt Whisper ngắn — dài quá khiến model lặp lại transcript cũ
WHISPER_CONTEXT_MAX = 64
# Cụm tối thiểu coi là echo/lặp (ký tự CJK)
MIN_ECHO_SPAN = 10
MAX_ECHO_SPAN = 280

# Whisper hay ảo giác khi im lặng / nhiễu
_HALLUCINATION_PHRASES = (
    "ご視聴ありがとうございました",
    "ご視聴ありがとうございます",
    "ご清聴ありがとうございました",
    "字幕はごぜひご覧ください",
    "字幕提供",
    "thank you for watching",
    "thanks for watching",
    "subtitles by",
    "请不吝点赞",
    "チャンネル登録",
    "おやすみなさい",
    "では、また",
)

_HALLUCINATION_ONLY = re.compile(
    r"^[\s、。．！？,.!?…]*("
    + "|".join(re.escape(p) for p in _HALLUCINATION_PHRASES)
    + r")[\s、。．！？,.!?…]*$",
    re.IGNORECASE,
)


def build_whisper_prompt(base: str, tail: str | None) -> str:
    """Ghép ngữ cảnh đuôi transcript vào prompt Whisper (ngắn, tránh echo)."""
    ctx = (tail or "").strip()
    if not ctx:
        return base
    return f"{base} {ctx[-WHISPER_CONTEXT_MAX:]}"


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"([。．！？.?!…])", text.strip())
    sentences: list[str] = []
    buf = ""
    for i, part in enumerate(parts):
        buf += part
        if part in SENTENCE_END or i == len(parts) - 1:
            sent = buf.strip()
            buf = ""
            if sent:
                sentences.append(sent)
    return sentences if sentences else ([text.strip()] if text.strip() else [])


def _normalize_overlap_key(text: str) -> str:
    return re.sub(r"[\s\u3000、。．！？,.!?…]+", "", text.strip())


def strip_redundant_overlap(accumulated: str, fragment: str) -> str:
    """Bỏ phần đầu của fragment đã có ở cuối accumulated (Whisper echo)."""
    a = accumulated.strip()
    f = fragment.strip()
    if not f:
        return ""
    if not a:
        return f
    if f.startswith(a):
        return f[len(a) :].strip()
    if a.endswith(f):
        return ""

    max_ov = min(len(a), len(f), MAX_ECHO_SPAN)
    for size in range(max_ov, 0, -1):
        if a[-size:] == f[:size]:
            return f[size:].strip()

    na, nf = _normalize_overlap_key(a), _normalize_overlap_key(f)
    if nf.startswith(na) and len(nf) > len(na):
        return f[len(a) :].strip() if len(f) > len(a) else ""
    max_n = min(len(na), len(nf), MAX_ECHO_SPAN)
    for size in range(max_n, 0, -1):
        if na[-size:] == nf[:size]:
            return f[size:].strip()
    return f


def strip_echo_already_in_accumulated(accumulated: str, fragment: str) -> str:
    """
    Whisper hay trả lại cụm đã nói ở giữa transcript (không chỉ đuôi).
    Bỏ prefix của fragment nếu đã xuất hiện trong accumulated.
    """
    a = accumulated.strip()
    f = fragment.strip()
    if not f:
        return ""
    if not a:
        return f
    if f in a:
        return ""

    na, nf = _normalize_overlap_key(a), _normalize_overlap_key(f)
    if nf and nf in na:
        return ""

    max_prefix = min(len(f), MAX_ECHO_SPAN)
    for size in range(max_prefix, MIN_ECHO_SPAN - 1, -1):
        prefix = f[:size]
        nprefix = _normalize_overlap_key(prefix)
        if len(nprefix) < MIN_ECHO_SPAN:
            continue
        if prefix in a or nprefix in na:
            remainder = f[size:].strip()
            if not remainder:
                return ""
            return strip_echo_already_in_accumulated(a, remainder)
    return f


def collapse_consecutive_duplicate_spans(
    text: str,
    min_len: int = MIN_ECHO_SPAN,
    max_len: int = MAX_ECHO_SPAN,
) -> str:
    """Bỏ mọi đoạn AB→AB liên tiếp trong transcript liên tục."""
    t = text.strip()
    if len(t) < min_len * 2:
        return t

    changed = True
    while changed and len(t) >= min_len * 2:
        changed = False
        limit = min(len(t) // 2, max_len)
        for size in range(limit, min_len - 1, -1):
            pos = 0
            while pos + size * 2 <= len(t):
                if t[pos : pos + size] == t[pos + size : pos + size * 2]:
                    t = t[: pos + size] + t[pos + size * 2 :]
                    changed = True
                    pos = max(0, pos - size)
                else:
                    pos += 1
            if changed:
                break
    return t.strip()


def remove_later_duplicate_spans(
    text: str,
    min_len: int = MIN_ECHO_SPAN,
    max_len: int = MAX_ECHO_SPAN,
) -> str:
    """Xóa lần xuất hiện sau của cụm đã có (echo giữa đoạn dài)."""
    t = text.strip()
    if len(t) < min_len * 2:
        return t

    changed = True
    while changed and len(t) >= min_len * 2:
        changed = False
        limit = min(len(t) // 2, max_len)
        for size in range(limit, min_len - 1, -1):
            pos = 0
            while pos + size <= len(t):
                chunk = t[pos : pos + size]
                if len(_normalize_overlap_key(chunk)) < min_len:
                    pos += 1
                    continue
                second = t.find(chunk, pos + size)
                if second > 0:
                    t = t[:second] + t[second + size :]
                    changed = True
                    break
                pos += 1
            if changed:
                break
    return t.strip()


def _finalize_merged_text(text: str) -> str:
    return dedupe_stt_repetition(text.strip())


def dedupe_sentence_loops(text: str) -> str:
    """Bỏ khối câu lặp vòng (A.B.C.A.B.C → A.B.C)."""
    sentences = _split_sentences(text)
    if len(sentences) < 2:
        return text.strip()

    deduped: list[str] = []
    for s in sentences:
        if not deduped or s != deduped[-1]:
            deduped.append(s)

    while len(deduped) >= 2:
        removed = False
        max_k = len(deduped) // 2
        for k in range(max_k, 0, -1):
            if deduped[-k:] == deduped[-2 * k : -k]:
                deduped = deduped[:-k]
                removed = True
                break
        if not removed:
            break

    return "".join(deduped)


def extract_incremental_stt(
    accumulated: str, incoming: str, language: str
) -> tuple[str, str]:
    """
    Trả về (phần_mới, accumulated_sau_merge).
    Whisper + prompt hay trả lại cả đoạn cũ — chỉ lấy phần tăng thêm.
    """
    prev = accumulated.strip()
    inc = polish_stt_text(incoming, language)
    if not inc:
        return "", prev
    inc = strip_echo_already_in_accumulated(prev, inc)
    if not inc:
        return "", prev
    inc = strip_redundant_overlap(prev, inc)
    if not inc:
        return "", prev

    if not prev:
        cleaned = dedupe_stt_repetition(inc)
        return cleaned, cleaned

    if inc.startswith(prev):
        suffix = inc[len(prev) :].strip()
        if not suffix:
            return "", prev
        merged = _finalize_merged_text(merge_stt_fragments(prev, suffix))
        return merged[len(prev) :].strip() if merged.startswith(prev) else suffix, merged

    if prev in inc:
        idx = inc.find(prev)
        if idx >= 0:
            suffix = inc[idx + len(prev) :].strip()
            if suffix:
                merged = _finalize_merged_text(
                    polish_stt_text(merge_stt_fragments(prev, suffix), language)
                )
                delta = merged[len(prev) :].strip() if merged.startswith(prev) else suffix
                return delta, merged
            return "", prev

    merged = _finalize_merged_text(
        polish_stt_text(merge_stt_fragments(prev, inc), language)
    )

    if merged == prev:
        return "", prev
    if merged.startswith(prev):
        return merged[len(prev) :].strip(), merged

    for size in range(min(len(prev), len(inc), MAX_ECHO_SPAN), 1, -1):
        tail = prev[-size:]
        if inc.startswith(tail):
            suffix = inc[size:].strip()
            if suffix:
                merged2 = _finalize_merged_text(
                    polish_stt_text(merge_stt_fragments(prev, suffix), language)
                )
                if len(merged2) > len(prev):
                    return merged2[len(prev) :].strip(), merged2

    if len(merged) > len(prev):
        return merged[len(prev) :].strip(), merged
    return "", prev


def dedupe_stt_repetition(text: str) -> str:
    """Bỏ câu/cụm lặp liên tiếp do STT chồng chunk."""
    t = collapse_consecutive_duplicate_spans(text.strip())
    t = dedupe_sentence_loops(t)
    if not t:
        return t

    changed = True
    while changed and len(t) >= 16:
        changed = False
        half = len(t) // 2
        for size in range(min(half, MAX_ECHO_SPAN), 6, -1):
            if t[:size] == t[size : size * 2]:
                t = (t[:size] + t[size * 2 :]).strip()
                changed = True
                break

    parts = re.split(r"(\s+)", t)
    if len(parts) >= 4:
        deduped: list[str] = []
        i = 0
        while i < len(parts):
            deduped.append(parts[i])
            if (
                i + 2 < len(parts)
                and parts[i].strip()
                and parts[i] == parts[i + 2]
                and not parts[i + 1].strip()
            ):
                i += 2
            else:
                i += 1
        t = "".join(deduped).strip()

    t = collapse_consecutive_duplicate_spans(t)
    t = remove_later_duplicate_spans(t)
    return dedupe_sentence_loops(t)


def is_hallucination_only(text: str) -> bool:
    t = text.strip()
    if not t or len(t) > 80:
        return False
    low = t.lower()
    if _HALLUCINATION_ONLY.match(low):
        return True
    for phrase in _HALLUCINATION_PHRASES:
        if low == phrase.lower() or low.replace("。", "") == phrase.lower():
            return True
    return False


def normalize_japanese_punctuation(text: str) -> str:
    t = text
    t = t.replace("｡", "。").replace("､", "、")
    t = re.sub(r"\.{3,}", "…", t)
    t = re.sub(r"…{2,}", "…", t)
    return t


def polish_stt_text(text: str, language: str) -> str:
    """Pipeline hậu xử lý STT trước khi hiển thị/dịch."""
    if not text or not text.strip():
        return ""
    t = sanitize_stt_output(text, language)
    if not t or is_hallucination_only(t):
        return ""
    t = normalize_japanese_punctuation(t)
    lang = (language or "ja").strip().lower()
    if lang == "ja" or re.search(r"[\u3040-\u30ff\u4e00-\u9fff]", t):
        t = polish_japanese_stt(t)
    t = dedupe_stt_repetition(t)
    return t.strip()


def stt_context_tail(text: str, max_len: int = WHISPER_CONTEXT_MAX) -> str:
    """Đuôi transcript làm ngữ cảnh cho chunk STT tiếp theo."""
    t = text.strip()
    if not t:
        return ""
    return t[-max_len:]
