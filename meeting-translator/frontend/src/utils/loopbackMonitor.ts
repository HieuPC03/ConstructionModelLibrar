import { pickHeadphoneOutputDevice } from "./audioDevices";

/**
 * Phát lại luồng VB-Cable / loopback ra tai nghe thật trong khi app ghi STT.
 * Dùng setSinkId để không phụ thuộc loa mặc định Windows (có thể là CABLE Input).
 */
let monitorCtx: AudioContext | null = null;
let monitorNodes: {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
} | null = null;

type SinkCapableContext = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

async function resolveHeadphoneSinkId(): Promise<string | undefined> {
  if (!navigator.mediaDevices?.enumerateDevices) return undefined;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return pickHeadphoneOutputDevice(devices)?.deviceId || undefined;
  } catch {
    return undefined;
  }
}

async function routeContextToHeadphones(ctx: SinkCapableContext): Promise<void> {
  if (typeof ctx.setSinkId !== "function") return;
  const sinkId = await resolveHeadphoneSinkId();
  if (!sinkId || sinkId === "default") return;
  try {
    await ctx.setSinkId(sinkId);
  } catch {
    /* dùng loa mặc định */
  }
}

export async function startLoopbackMonitor(
  stream: MediaStream,
  volume = 1
): Promise<boolean> {
  stopLoopbackMonitor();
  if (!stream.getAudioTracks().length) return false;

  const sinkId = await resolveHeadphoneSinkId();
  if (!sinkId) return false;

  const ctx = new AudioContext() as SinkCapableContext;
  await routeContextToHeadphones(ctx);
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
  return true;
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
