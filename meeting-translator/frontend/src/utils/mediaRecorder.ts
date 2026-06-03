const AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "",
];

const VIDEO_MIME_CANDIDATES = [
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9,opus",
  "video/webm",
  "video/mp4",
];

export function createMediaRecorder(
  stream: MediaStream,
  mimeCandidates: string[] = AUDIO_MIME_CANDIDATES
): { recorder: MediaRecorder; mimeType: string } {
  for (const mime of mimeCandidates) {
    if (mime && !MediaRecorder.isTypeSupported(mime)) continue;
    try {
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      return {
        recorder,
        mimeType: recorder.mimeType || mime || "audio/webm",
      };
    } catch {
      continue;
    }
  }
  try {
    const recorder = new MediaRecorder(stream);
    return { recorder, mimeType: recorder.mimeType || "audio/webm" };
  } catch {
    throw new Error(
      "Không ghi được âm thanh (MediaRecorder). Thử «Chỉ micro», hoặc «Quay màn hình» và bật «Chia sẻ âm thanh» trong hộp thoại Windows."
    );
  }
}

export function tryCreateVideoRecorder(
  stream: MediaStream
): { recorder: MediaRecorder; mimeType: string } | null {
  try {
    return createMediaRecorder(stream, VIDEO_MIME_CANDIDATES);
  } catch {
    return null;
  }
}

export function friendlyMediaError(err: unknown): string {
  const msg = (err as Error)?.message || String(err);
  if (/not supported/i.test(msg)) {
    return (
      "Trình duyệt không hỗ trợ định dạng ghi âm. Thử «Chỉ micro» hoặc chia sẻ màn hình kèm âm thanh."
    );
  }
  return msg;
}
