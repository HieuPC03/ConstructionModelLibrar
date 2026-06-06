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

function normalizeOverlapKey(text: string): string {
  return text.replace(/[\s\u3000、。．！？,.!?…]+/g, "");
}

/** Bỏ phần đầu chunk trùng đuôi prev (Whisper hay echo). */
export function stripRedundantOverlap(prev: string, chunk: string): string {
  const p = prev.trim();
  const c = chunk.trim();
  if (!c) return "";
  if (!p) return c;
  if (c.startsWith(p)) return c.slice(p.length).trim();
  if (p.endsWith(c)) return "";

  const maxOv = Math.min(p.length, c.length, 120);
  for (let size = maxOv; size >= 2; size--) {
    if (p.slice(-size) === c.slice(0, size)) {
      return c.slice(size).trim();
    }
  }

  const np = normalizeOverlapKey(p);
  const nc = normalizeOverlapKey(c);
  const maxN = Math.min(np.length, nc.length, 120);
  for (let size = maxN; size >= 2; size--) {
    if (np.slice(-size) === nc.slice(0, size)) {
      return c.slice(size).trim();
    }
  }
  return c;
}

export function applyChunkToSegmentText(prev: string, chunk: string): string {
  const c = stripRedundantOverlap(prev, chunk);
  if (!c) return prev.trimEnd();
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
