"""Gom STT cho dịch realtime — chỉ phát utterance khi hết câu."""

from __future__ import annotations

SENTENCE_END = ".?!。．？！…"
MAX_PENDING_CHARS = 600
# Số chunk im lặng liên tiếp (~3s/chunk) trước khi chốt câu không có dấu chấm
SILENCE_CHUNKS_TO_FLUSH = 2
# Một chunk im + đủ chữ → coi như hết câu (ngắt nghỉ ngắn)
SILENCE_ONE_CHUNK_MIN_CHARS = 14


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
    if not prev.endswith(" ") and not nxt.startswith((",", ".", "?", "!", ":", ";", "、")):
        return f"{prev} {nxt}"
    return prev + nxt


def is_sentence_complete(text: str) -> bool:
    t = text.rstrip()
    if len(t) < 2:
        return False
    return t[-1] in SENTENCE_END


def should_flush_on_silence(silence_streak: int, pending: str) -> bool:
    p = pending.strip()
    if not p:
        return False
    if silence_streak >= SILENCE_CHUNKS_TO_FLUSH:
        return True
    if silence_streak >= 1 and len(p) >= SILENCE_ONE_CHUNK_MIN_CHARS:
        return True
    return False


def should_flush_buffer(pending: str, silence_streak: int) -> bool:
    p = pending.strip()
    if not p:
        return False
    if len(p) >= MAX_PENDING_CHARS:
        return True
    if is_sentence_complete(p):
        return True
    return should_flush_on_silence(silence_streak, p)
