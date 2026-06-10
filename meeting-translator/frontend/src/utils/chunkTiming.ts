const CHUNK_BASE_MS = 1500;
const CHUNK_MAX_MS = 2200;
const CHUNK_OVERLAP_MS = 300;

export function adaptiveChunkMs(
  hasSpeech: boolean,
  speechContinuous: boolean,
  mode: "transcript" | "translate_realtime"
): number {
  const base = CHUNK_BASE_MS;
  if (!hasSpeech) return base;
  if (speechContinuous) {
    return Math.min(CHUNK_MAX_MS, base + CHUNK_OVERLAP_MS);
  }
  if (mode === "translate_realtime" && speechContinuous) {
    return CHUNK_MAX_MS;
  }
  return base;
}

export { CHUNK_BASE_MS, CHUNK_MAX_MS, CHUNK_OVERLAP_MS };
