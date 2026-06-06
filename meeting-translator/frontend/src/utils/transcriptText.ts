const SENTENCE_END = ".?!。．？！…";
const CJK_CHAR = /[\u3040-\u30ff\u4e00-\u9fff]/;
const NO_SPACE_BEFORE = /^[,.;:!?)、。．！？…]/;

/** Chuẩn hóa đoạn transcript hiển thị liên tục (không xuống dòng từng câu). */
export function formatSegmentParagraph(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

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
  const p = prev.trimEnd();
  if (!p) return c;

  const last = p.slice(-1);
  const first = c[0];
  const bothCjk = CJK_CHAR.test(last) && CJK_CHAR.test(first);

  if (bothCjk || NO_SPACE_BEFORE.test(c)) {
    return `${p}${c}`;
  }
  if (SENTENCE_END.includes(last)) {
    return `${p}${c}`;
  }
  if (!p.endsWith(" ") && !NO_SPACE_BEFORE.test(c)) {
    return `${p} ${c}`;
  }
  return `${p}${c}`;
}
