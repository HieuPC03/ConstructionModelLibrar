import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioDeviceOption } from "../types";
import { friendlyMediaError } from "../utils/mediaRecorder";

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

  const refreshDevices = useCallback(async (): Promise<AudioDeviceOption[]> => {
    setError(null);
    if (!navigator.mediaDevices?.enumerateDevices) {
      const msg = "Trình duyệt không hỗ trợ liệt kê thiết bị âm thanh.";
      setError(msg);
      return [];
    }
    let temp: MediaStream | null = null;
    try {
      const pre = await navigator.mediaDevices.enumerateDevices();
      const inputs = pre.filter((d) => d.kind === "audioinput");
      const needsLabel = inputs.length > 0 && inputs.every((d) => !d.label);
      if (needsLabel) {
        try {
          temp = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (permErr) {
          setError(
            `Cần quyền micro để hiện tên thiết bị: ${(permErr as Error).message}`
          );
        }
      }
      const list = await listAudioInputs();
      setDevices(list);
      return list;
    } catch (e) {
      setError((e as Error).message);
      return [];
    } finally {
      temp?.getTracks().forEach((t) => t.stop());
    }
  }, []);

  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const onChange = () => {
      refreshDevices().catch(() => undefined);
    };
    md.addEventListener("devicechange", onChange);
    return () => md.removeEventListener("devicechange", onChange);
  }, [refreshDevices]);

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
        let mixMic = includeMic;
        if (mode === "display" || mode === "screen") {
          const display = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          if (display.getVideoTracks().length > 0) {
            screenVideoRef.current = new MediaStream(display.getVideoTracks());
          }
          if (display.getAudioTracks().length > 0) {
            streams.push(new MediaStream(display.getAudioTracks()));
          }
          if (mode === "screen") {
            mixMic = true;
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

        if (mixMic) {
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
        const msg = friendlyMediaError(e);
        setError(msg);
        throw new Error(msg);
      }
    },
    [stopAll]
  );

  /** Video + mixed audio for screen recording (mp4/webm). */
  const getCompositeRecordStream = useCallback((): MediaStream | null => {
    const video = screenVideoRef.current;
    const audio = mixedRef.current;
    if (!video?.getVideoTracks().length) return null;
    const combined = new MediaStream();
    video.getVideoTracks().forEach((t) => combined.addTrack(t));
    audio?.getAudioTracks().forEach((t) => combined.addTrack(t));
    return combined.getTracks().length > 0 ? combined : null;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    devices,
    error,
    clearError,
    refreshDevices,
    startCapture,
    stopAll,
    getMixedStream: () => mixedRef.current,
    getScreenVideoStream: () => screenVideoRef.current,
    getCompositeRecordStream,
  };
}
