import { useCallback, useEffect, useRef, useState } from "react";

const SPEECH_THRESHOLD = 0.018;
const CONTINUOUS_MS = 2400;
const UPDATE_INTERVAL_MS = 200;

export type VadState = {
  hasSpeech: boolean;
  speechContinuous: boolean;
  level: number;
};

const IDLE_VAD: VadState = {
  hasSpeech: false,
  speechContinuous: false,
  level: 0,
};

export function useVadMonitor(stream: MediaStream | null, enabled: boolean) {
  const [vad, setVad] = useState<VadState>(IDLE_VAD);
  const lastSpeechAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const mountedRef = useRef(true);
  const lastPublishRef = useRef(0);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx && ctx.state !== "closed") {
      void ctx.close().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stop();
    };
  }, [stop]);

  useEffect(() => {
    if (!enabled || !stream) {
      stop();
      if (mountedRef.current) setVad(IDLE_VAD);
      return;
    }

    let cancelled = false;
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);

    const publish = (next: VadState) => {
      if (!mountedRef.current || cancelled) return;
      setVad(next);
    };

    const tick = () => {
      if (cancelled) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const now = Date.now();
      const hasSpeech = rms >= SPEECH_THRESHOLD;
      if (hasSpeech) lastSpeechAtRef.current = now;
      const speechContinuous = now - lastSpeechAtRef.current < CONTINUOUS_MS;
      if (now - lastPublishRef.current >= UPDATE_INTERVAL_MS) {
        lastPublishRef.current = now;
        publish({ hasSpeech, speechContinuous, level: rms });
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      stop();
      if (mountedRef.current) setVad(IDLE_VAD);
    };
  }, [stream, enabled, stop]);

  return vad;
}
