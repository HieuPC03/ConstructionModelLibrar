import { useCallback, useEffect, useRef, useState } from "react";

const SPEECH_THRESHOLD = 0.018;
const CONTINUOUS_MS = 2400;

export type VadState = {
  hasSpeech: boolean;
  speechContinuous: boolean;
  level: number;
};

export function useVadMonitor(stream: MediaStream | null, enabled: boolean) {
  const [vad, setVad] = useState<VadState>({
    hasSpeech: false,
    speechContinuous: false,
    level: 0,
  });
  const lastSpeechAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (ctxRef.current) {
      void ctxRef.current.close();
      ctxRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !stream) {
      stop();
      setVad({ hasSpeech: false, speechContinuous: false, level: 0 });
      return;
    }

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);

    const tick = () => {
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
      setVad({
        hasSpeech,
        speechContinuous,
        level: rms,
      });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return stop;
  }, [stream, enabled, stop]);

  return vad;
}
