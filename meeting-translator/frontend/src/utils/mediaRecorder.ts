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

const streamContextMap = new WeakMap<MediaStream, AudioContext>();

export {
  isLoopbackDeviceLabel,
  isStereoMixLabel,
  isVirtualLoopbackLabel,
} from "./audioDevices";

export function canUseMediaRecorder(
  stream: MediaStream,
  mimeCandidates: string[] = AUDIO_MIME_CANDIDATES
): boolean {
  if (!stream.getAudioTracks().length && !stream.getVideoTracks().length) {
    return false;
  }
  for (const mime of mimeCandidates) {
    if (mime && !MediaRecorder.isTypeSupported(mime)) continue;
    try {
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      if (recorder.state === "recording") recorder.stop();
      return true;
    } catch {
      continue;
    }
  }
  try {
    new MediaRecorder(stream);
    return true;
  } catch {
    return false;
  }
}

async function resumeContext(ctx: AudioContext): Promise<void> {
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

/** Đảm bảo AudioContext (khi trộn loopback + micro) không bị im lặng. */
export async function resumeStreamAudioContext(stream: MediaStream): Promise<void> {
  const ctx = streamContextMap.get(stream);
  if (ctx) await resumeContext(ctx);
}

/** Chọn luồng âm thanh ghi được (tránh AudioContext không tương thích Windows/Electron). */
export async function pickRecordableAudioStream(
  streams: MediaStream[]
): Promise<MediaStream> {
  const withAudio = streams.filter((s) => s.getAudioTracks().length > 0);
  if (!withAudio.length) {
    throw new Error(
      "Không có âm thanh. Khi quay màn hình, bật «Chia sẻ âm thanh» trong hộp thoại Windows."
    );
  }
  for (const s of withAudio) {
    if (canUseMediaRecorder(s)) return s;
  }
  if (withAudio.length === 1) return withAudio[0];

  const ctx = new AudioContext();
  const dest = ctx.createMediaStreamDestination();
  withAudio.forEach((s) => {
    ctx.createMediaStreamSource(s).connect(dest);
  });
  await resumeContext(ctx);
  streamContextMap.set(dest.stream, ctx);
  if (canUseMediaRecorder(dest.stream)) return dest.stream;

  const fallback = withAudio[0];
  if (canUseMediaRecorder(fallback)) return fallback;
  throw new Error(
    "Không ghi được âm thanh từ nguồn này. Thử «Chỉ micro» hoặc bật Stereo Mix trong Cài đặt âm thanh Windows."
  );
}

/** Tên file gửi Whisper — khớp MIME thực tế của MediaRecorder. */
export function chunkFilenameForMime(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes("ogg")) return "chunk.ogg";
  if (m.includes("mp4") || m.includes("m4a")) return "chunk.m4a";
  if (m.includes("wav")) return "chunk.wav";
  return "chunk.webm";
}

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
      "Không ghi được âm thanh. Thử «Chỉ micro» hoặc chia sẻ màn hình kèm âm thanh."
    );
  }
}

export function tryCreateVideoRecorder(
  stream: MediaStream
): { recorder: MediaRecorder; mimeType: string } | null {
  if (!canUseMediaRecorder(stream, VIDEO_MIME_CANDIDATES)) return null;
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
      "Không ghi được âm thanh từ nguồn này. Thử «Chỉ micro», bật Stereo Mix, hoặc quay màn hình kèm «Chia sẻ âm thanh»."
    );
  }
  return msg;
}
