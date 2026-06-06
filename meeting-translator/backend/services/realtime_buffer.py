"""Gom STT cho dịch realtime — chỉ phát utterance khi hết câu."""

from __future__ import annotations

import re

SENTENCE_END = ".?!。．？！…"
MAX_PENDING_CHARS = 600
# Số chunk im lặng liên tiếp trước khi chốt (chunk ~1s)
SILENCE_CHUNKS_TO_FLUSH = 3
# Tối thiểu ký tự để coi là câu có nghĩa
MIN_MEANINGFUL_CHARS = 8
# Im lặng lâu nhưng không có dấu kết thúc — cần đủ dài
MIN_SILENCE_FLUSH_CHARS = 22
# Câu ngắn có dấu kết thúc — cần thêm im lặng
SHORT_SENTENCE_MAX_CHARS = 16


def merge_stt_fragments(previous: str, new: str) -> str:
    """Ghép các đoạn STT chồng lấn từ chunk liên tiếp."""
    prev = previous.strip()
    nxt = new.strip()
    if not nxt:
        return prev
    if not prev:
        return nxt
    if nxt.startswith(prev):
        return nxt
    if prev.startswith(nxt):
        return prev
    # Trùng đuôi/đầu (Whisper hay lặp)
    max_ov = min(len(prev), len(nxt), 80)
    for size in range(max_ov, 3, -1):
        if prev[-size:] == nxt[:size]:
            return prev + nxt[size:]
    last, first = prev[-1], nxt[0]
    cjk = r"[\u3040-\u30ff\u4e00-\u9fff]"
    if re.search(cjk, last) and re.search(cjk, first):
        return prev + nxt
    if not prev.endswith(" ") and not nxt.startswith(
        (",", ".", "?", "!", ":", ";", "、", "。")
    ):
        return f"{prev} {nxt}"
    return prev + nxt


def is_sentence_complete(text: str) -> bool:
    t = text.rstrip()
    if len(t) < 2:
        return False
    return t[-1] in SENTENCE_END


def is_meaningful_utterance(text: str) -> bool:
    """Câu đủ dài / có nội dung thật — tránh đẩy fragment STT."""
    p = text.strip()
    if len(p) < MIN_MEANINGFUL_CHARS:
        return False
    if re.search(r"[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]", p):
        return len(re.sub(r"\s", "", p)) >= MIN_MEANINGFUL_CHARS
    words = [w for w in re.split(r"\s+", p) if w]
    return len(words) >= 2 or len(p) >= 12


def should_flush_buffer(pending: str, silence_streak: int) -> bool:
    """Live Caption / buffer cũ — chốt chậm, cần im lặng."""
    p = pending.strip()
    if not p:
        return False
    if len(p) >= MAX_PENDING_CHARS:
        return is_meaningful_utterance(p)
    if not is_meaningful_utterance(p):
        return False
    if is_sentence_complete(p):
        need_silence = 2 if len(p) <= SHORT_SENTENCE_MAX_CHARS else 1
        if silence_streak >= need_silence:
            return True
    if silence_streak >= SILENCE_CHUNKS_TO_FLUSH and len(p) >= MIN_SILENCE_FLUSH_CHARS:
        return True
    return False


# Dịch realtime — chốt ngay khi có dấu kết thúc câu
REALTIME_MIN_CHARS = 4


def is_meaningful_realtime_sentence(text: str) -> bool:
    p = text.strip()
    if len(p) < REALTIME_MIN_CHARS:
        return False
    if re.search(r"[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]", p):
        return len(re.sub(r"\s", "", p)) >= REALTIME_MIN_CHARS
    return len(p) >= 6


def pop_complete_sentences(text: str) -> tuple[list[str], str]:
    """Tách các câu đã hoàn chỉnh ở đầu buffer — đẩy từng câu, giữ phần đang nói dở."""
    t = text.strip()
    if not t:
        return [], ""

    parts = re.split(r"(?<=[。．！？.?!…])", t)
    complete: list[str] = []
    remainder_parts: list[str] = []

    for part in parts:
        p = part.strip()
        if not p:
            continue
        if p[-1] in SENTENCE_END and is_meaningful_realtime_sentence(p):
            complete.append(p)
        else:
            remainder_parts.append(p)

    remainder = "".join(remainder_parts).strip()
    return complete, remainder


def should_flush_realtime_remainder(pending: str, silence_streak: int) -> bool:
    """Phần còn lại chưa có dấu câu — chỉ chốt khi im lặng ngắn (không chờ đoạn dài)."""
    p = pending.strip()
    if not p:
        return False
    if is_sentence_complete(p) and is_meaningful_realtime_sentence(p):
        return True
    if silence_streak >= 2 and is_meaningful_realtime_sentence(p):
        return True
    if len(p) >= MAX_PENDING_CHARS:
        return True
    return False
