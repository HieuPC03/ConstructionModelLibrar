import { useCallback, useRef, useState } from "react";
import type { AudioDeviceOption } from "../types";

export type CaptureMode = "loopback" | "display" | "screen" | "mic";

async function listAudioInputs(): Promise<AudioDeviceOption[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "audioinput")
    .map((d) => ({
      deviceId: d.deviceId,
      label: d.label || `Thiết bị ${d.deviceId.slice(0, 8)}…`,
    }));
}

export function useAudioCapture() {
  const [devices, setDevices] = useState<AudioDeviceOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const mixedRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<MediaStream | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        /* permission optional for enumerate */
      }
      const list = await listAudioInputs();
      setDevices(list);
      stream?.getTracks().forEach((t) => t.stop());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const stopAll = useCallback(() => {
    streamsRef.current.forEach((s) =>
      s.getTracks().forEach((t) => t.stop())
    );
    streamsRef.current = [];
    mixedRef.current = null;
    screenVideoRef.current?.getTracks().forEach((t) => t.stop());
    screenVideoRef.current = null;
  }, []);

  const startCapture = useCallback(
    async (
      mode: CaptureMode,
      loopbackDeviceId?: string,
      includeMic = false,
      micDeviceId?: string
    ): Promise<MediaStream> => {
      stopAll();
      setError(null);
      const streams: MediaStream[] = [];

      try {
        if (mode === "display" || mode === "screen") {
          const display = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          if (mode === "screen" && display.getVideoTracks().length > 0) {
            screenVideoRef.current = new MediaStream(display.getVideoTracks());
          } else {
            display.getVideoTracks().forEach((t) => t.stop());
          }
          if (display.getAudioTracks().length > 0) {
            streams.push(new MediaStream(display.getAudioTracks()));
          }
        } else if (mode === "loopback" && loopbackDeviceId) {
          const loop = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: loopbackDeviceId },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          });
          streams.push(loop);
        }

        if (includeMic) {
          const mic = await navigator.mediaDevices.getUserMedia({
            audio: micDeviceId
              ? { deviceId: { exact: micDeviceId } }
              : true,
          });
          streams.push(mic);
        }

        if (streams.length === 0) {
          throw new Error(
            "Không có nguồn âm thanh. Chọn Stereo Mix / loopback hoặc chia sẻ tab cuộc họp."
          );
        }

        streamsRef.current = streams;

        if (streams.length === 1) {
          mixedRef.current = streams[0];
          return streams[0];
        }

        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        streams.forEach((s) => {
          const source = ctx.createMediaStreamSource(s);
          source.connect(dest);
        });
        mixedRef.current = dest.stream;
        return dest.stream;
      } catch (e) {
        stopAll();
        const msg = (e as Error).message;
        setError(msg);
        throw e;
      }
    },
    [stopAll]
  );

  return {
    devices,
    error,
    refreshDevices,
    startCapture,
    stopAll,
    getMixedStream: () => mixedRef.current,
    getScreenVideoStream: () => screenVideoRef.current,
  };
}
