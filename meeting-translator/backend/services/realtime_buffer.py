"""Gom STT cho dịch realtime — đẩy từng câu, không gộp đoạn dài."""

from __future__ import annotations

import re

SENTENCE_END = ".?!。．？！…"
MAX_PENDING_CHARS = 600
# Chờ im lặng 1 chunk trước khi chốt phần dở (~1.5s/chunk)
SILENCE_CHUNKS_TO_FLUSH = 1
SILENCE_ONE_CHUNK_MIN_CHARS = 6
REALTIME_MIN_CHARS = 4


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
    # Trùng đuôi/đầu (Whisper hay lặp) — kiểm tra từ 1 ký tự (CJK 2 ký tự)
    max_ov = min(len(prev), len(nxt), 80)
    for size in range(max_ov, 0, -1):
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


def should_flush_on_silence(silence_streak: int, pending: str) -> bool:
    p = pending.strip()
    if not p:
        return False
    if silence_streak >= SILENCE_CHUNKS_TO_FLUSH:
        return True
    if silence_streak >= 1 and len(p) >= SILENCE_ONE_CHUNK_MIN_CHARS:
        return True
    return False


def is_meaningful_realtime_sentence(text: str) -> bool:
    p = text.strip()
    if len(p) < REALTIME_MIN_CHARS:
        return False
    if re.search(r"[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]", p):
        return len(re.sub(r"\s", "", p)) >= REALTIME_MIN_CHARS
    return len(p) >= 6


def pop_complete_sentences(text: str) -> tuple[list[str], str]:
    """Tách câu hoàn chỉnh ở đầu buffer — mỗi câu dịch riêng."""
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
            remainder_parts.append(part)

    remainder = "".join(remainder_parts).strip()
    return complete, remainder


def should_flush_realtime_remainder(pending: str, silence_streak: int) -> bool:
    """Phần chưa có dấu câu — chốt sau 1 chunk im lặng."""
    p = pending.strip()
    if not p:
        return False
    if is_sentence_complete(p) and is_meaningful_realtime_sentence(p):
        return silence_streak >= SILENCE_CHUNKS_TO_FLUSH
    if silence_streak >= SILENCE_CHUNKS_TO_FLUSH and is_meaningful_realtime_sentence(p):
        return True
    if len(p) >= MAX_PENDING_CHARS:
        return True
    return False


def should_flush_buffer(pending: str, silence_streak: int) -> bool:
    """Live Caption — chốt chậm hơn (giữ tương thích)."""
    p = pending.strip()
    if not p:
        return False
    if len(p) >= MAX_PENDING_CHARS:
        return True
    if is_sentence_complete(p):
        return silence_streak >= SILENCE_CHUNKS_TO_FLUSH
    return should_flush_on_silence(silence_streak, p)
