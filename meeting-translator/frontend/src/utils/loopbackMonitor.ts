/**
 * Phát lại luồng VB-Cable / loopback ra thiết bị nghe mặc định (tai nghe)
 * trong khi app vẫn ghi âm cho STT.
 */
let monitorCtx: AudioContext | null = null;
let monitorNodes: {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
} | null = null;

export async function startLoopbackMonitor(
  stream: MediaStream,
  volume = 1
): Promise<void> {
  stopLoopbackMonitor();
  if (!stream.getAudioTracks().length) return;

  const ctx = new AudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  const source = ctx.createMediaStreamSource(stream);
  const gain = ctx.createGain();
  gain.gain.value = Math.min(1, Math.max(0, volume));
  source.connect(gain);
  gain.connect(ctx.destination);

  monitorCtx = ctx;
  monitorNodes = { source, gain };
}

export function setLoopbackMonitorVolume(volume: number): void {
  if (monitorNodes) {
    monitorNodes.gain.gain.value = Math.min(1, Math.max(0, volume));
  }
}

export function stopLoopbackMonitor(): void {
  try {
    monitorNodes?.source.disconnect();
    monitorNodes?.gain.disconnect();
  } catch {
    /* ignore */
  }
  monitorNodes = null;
  if (monitorCtx) {
    void monitorCtx.close();
    monitorCtx = null;
  }
}

export function isLoopbackMonitorActive(): boolean {
  return monitorCtx !== null;
}
