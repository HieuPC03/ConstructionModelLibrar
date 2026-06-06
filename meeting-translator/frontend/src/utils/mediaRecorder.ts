const AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
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
  isCableOutputLabel,
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
      recorder.stop();
      return true;
    } catch {
      continue;
    }
  }
  try {
    const recorder = new MediaRecorder(stream);
    recorder.stop();
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

export async function resumeStreamAudioContext(stream: MediaStream): Promise<void> {
  const ctx = streamContextMap.get(stream);
  if (ctx) await resumeContext(ctx);
}

async function mixAudioStreams(streams: MediaStream[]): Promise<MediaStream> {
  const ctx = new AudioContext({ sampleRate: 48000 });
  const dest = ctx.createMediaStreamDestination();
  streams.forEach((s) => {
    if (s.getAudioTracks().length) {
      ctx.createMediaStreamSource(s).connect(dest);
    }
  });
  await resumeContext(ctx);
  streamContextMap.set(dest.stream, ctx);
  return dest.stream;
}

/** Chọn luồng ghi được — ưu tiên VB-Cable đơn, trộn micro khi cần. */
export async function pickRecordableAudioStream(
  streams: MediaStream[]
): Promise<MediaStream> {
  const withAudio = streams.filter((s) => s.getAudioTracks().length > 0);
  if (!withAudio.length) {
    throw new Error(
      "Không có âm thanh. Chọn thiết bị «CABLE Output (VB-Audio)» trong dropdown, hoặc bật «Chia sẻ âm thanh hệ thống» khi Windows hỏi."
    );
  }

  for (const s of withAudio) {
    if (canUseMediaRecorder(s)) return s;
  }

  if (withAudio.length === 1) {
    return withAudio[0];
  }

  try {
    const mixed = await mixAudioStreams(withAudio);
    if (canUseMediaRecorder(mixed)) return mixed;
  } catch {
    /* thử từng nguồn */
  }

  for (const s of withAudio) {
    try {
      createMediaRecorder(s);
      return s;
    } catch {
      continue;
    }
  }

  return withAudio[0];
}

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
        ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128000 })
        : new MediaRecorder(stream, { audioBitsPerSecond: 128000 });
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
      "Không ghi được âm thanh. Chọn «CABLE Output (VB-Audio)» hoặc tắt «Thêm micro» thử lại."
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
  if (/not supported|notsupported/i.test(msg)) {
    return (
      "Không ghi được âm thanh từ VB-Cable/loopback. " +
      "Kiểm tra: (1) Zoom/Teams chọn loa «CABLE Input», (2) trong app chọn «CABLE Output», " +
      "(3) tắt «Thêm micro» thử lại, hoặc (4) chọn «Tự động» và bật «Chia sẻ âm thanh hệ thống»."
    );
  }
  if (/permission|denied|notallowed/i.test(msg)) {
    return "Cần quyền micro/âm thanh. Vào Cài đặt Windows → Quyền riêng tư → Microphone → bật cho app.";
  }
  return msg;
}
