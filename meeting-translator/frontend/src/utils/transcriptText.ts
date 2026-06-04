const SENTENCE_END = ".?!。．？！…";

/** Tách câu đã hoàn chỉnh (có dấu kết thúc) và phần đang nói dở. */
export function splitCompletedSentences(text: string): {
  completedSentences: string[];
  liveTail: string;
} {
  const t = text.trim();
  if (!t) return { completedSentences: [], liveTail: "" };

  const completed: string[] = [];
  let buffer = "";
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    buffer += ch;
    if (SENTENCE_END.includes(ch)) {
      const next = t[i + 1];
      if (!next || /\s/.test(next) || i === t.length - 1) {
        const sentence = buffer.trim();
        if (sentence) completed.push(sentence);
        buffer = "";
      }
    }
  }
  return { completedSentences: completed, liveTail: buffer.trim() };
}

export function applyChunkToSegmentText(prev: string, chunk: string): string {
  const c = chunk.trim();
  if (!c) return prev;
  if (!prev.trim()) return c;
  const needsSpace = !prev.endsWith(" ") && !/^[,.;:!?)]/.test(c);
  return needsSpace ? `${prev} ${c}` : `${prev}${c}`;
}
