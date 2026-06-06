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
    p = pending.strip()
    if not p:
        return False
    if len(p) >= MAX_PENDING_CHARS:
        return is_meaningful_utterance(p)
    if not is_meaningful_utterance(p):
        return False
    # Có dấu kết thúc + im lặng → người nói đã dừng câu
    if is_sentence_complete(p):
        need_silence = 2 if len(p) <= SHORT_SENTENCE_MAX_CHARS else 1
        if silence_streak >= need_silence:
            return True
    # Im lặng lâu (không có dấu câu) — chỉ chốt đoạn đủ dài
    if silence_streak >= SILENCE_CHUNKS_TO_FLUSH and len(p) >= MIN_SILENCE_FLUSH_CHARS:
        return True
    return False
