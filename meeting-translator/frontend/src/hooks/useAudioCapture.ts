import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioDeviceOption } from "../types";
import {
  isWindowsSystemAudioShare,
  listLoopbackDeviceOptions,
} from "../utils/audioDevices";
import {
  startLoopbackMonitor,
  stopLoopbackMonitor,
} from "../utils/loopbackMonitor";
import {
  friendlyMediaError,
  pickRecordableAudioStream,
} from "../utils/mediaRecorder";

export type CaptureMode = "loopback" | "system" | "mic";

async function listAudioInputs(): Promise<AudioDeviceOption[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "audioinput")
    .map((d) => ({
      deviceId: d.deviceId,
      label: d.label || `Thiết bị ${d.deviceId.slice(0, 8)}…`,
    }));
}

/**
 * Âm thanh hệ thống qua chia sẻ Windows (không cần VB-Cable).
 * Tai nghe vẫn nghe được khi suppressLocalAudioPlayback = false.
 */
async function captureSystemAudioViaDisplay(): Promise<MediaStream> {
  const videoConstraints = {
    width: { ideal: 64, max: 320 },
    height: { ideal: 64, max: 180 },
    frameRate: { max: 5 },
  };
  const audioConstraints = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    suppressLocalAudioPlayback: false,
  };

  const base: MediaStreamConstraints = {
    video: videoConstraints,
    audio: audioConstraints,
  };

  let display: MediaStream;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({
      ...base,
      // Chromium / Electron: chỉ lấy âm thanh hệ thống khi có
      systemAudio: "include",
    } as MediaStreamConstraints);
  } catch {
    display = await navigator.mediaDevices.getDisplayMedia(base);
  }

  display.getVideoTracks().forEach((t) => t.stop());

  let audioTracks = display.getAudioTracks();
  if (!audioTracks.length) {
    display.getTracks().forEach((t) => t.stop());
    throw new Error(
      "Không bắt được âm thanh hệ thống. Trong hộp thoại Windows: chọn «Toàn màn hình» hoặc cửa sổ ứng dụng và bật «Chia sẻ âm thanh hệ thống» (Share system audio). Âm thanh vẫn phát ra tai nghe — không cần bật micro."
    );
  }

  return new MediaStream(audioTracks);
}

async function openLoopbackDevice(deviceId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: { exact: deviceId },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
}

export function useAudioCapture() {
  const [devices, setDevices] = useState<AudioDeviceOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const mixedRef = useRef<MediaStream | null>(null);
  const systemAudioViaDisplayRef = useRef(false);

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
    stopLoopbackMonitor();
    streamsRef.current.forEach((s) =>
      s.getTracks().forEach((t) => t.stop())
    );
    streamsRef.current = [];
    mixedRef.current = null;
    systemAudioViaDisplayRef.current = false;
  }, []);

  const startCapture = useCallback(
    async (
      mode: CaptureMode,
      loopbackDeviceId?: string,
      includeMic = false,
      micDeviceId?: string,
      hearLoopback = true
    ): Promise<MediaStream> => {
      stopAll();
      setError(null);
      const audioStreams: MediaStream[] = [];
      let loopbackRawForMonitor: MediaStream | null = null;

      try {
        if (mode === "system" || mode === "loopback") {
          const useWindowsShare =
            mode === "system" ||
            isWindowsSystemAudioShare(loopbackDeviceId);

          if (useWindowsShare) {
            const sys = await captureSystemAudioViaDisplay();
            systemAudioViaDisplayRef.current = true;
            audioStreams.push(sys);
          } else if (loopbackDeviceId) {
            const loop = await openLoopbackDevice(loopbackDeviceId);
            loopbackRawForMonitor = loop;
            audioStreams.push(loop);
          } else {
            throw new Error(
              "Chọn «Không cần VB-Cable» hoặc một thiết bị VB-Cable / loopback."
            );
          }
        }

        if (mode === "mic" || includeMic) {
          const mic = await navigator.mediaDevices.getUserMedia({
            audio: micDeviceId
              ? { deviceId: { exact: micDeviceId } }
              : true,
          });
          audioStreams.push(mic);
        }

        if (audioStreams.length === 0) {
          throw new Error(
            "Không có nguồn âm thanh. Thử «Âm thanh hệ thống» hoặc «Chỉ micro»."
          );
        }

        streamsRef.current = audioStreams;
        const recordable = await pickRecordableAudioStream(audioStreams);
        mixedRef.current = recordable;

        if (
          mode === "loopback" &&
          hearLoopback &&
          loopbackRawForMonitor &&
          !systemAudioViaDisplayRef.current
        ) {
          const vol = includeMic ? 0.85 : 1;
          await startLoopbackMonitor(loopbackRawForMonitor, vol);
        }

        return recordable;
      } catch (e) {
        stopAll();
        const msg = friendlyMediaError(e);
        setError(msg);
        throw new Error(msg);
      }
    },
    [stopAll]
  );

  const clearError = useCallback(() => setError(null), []);

  const loopbackDevices = listLoopbackDeviceOptions(devices);

  return {
    devices,
    loopbackDevices,
    usesSystemAudioShare: () => systemAudioViaDisplayRef.current,
    error,
    clearError,
    refreshDevices,
    startCapture,
    stopAll,
    getMixedStream: () => mixedRef.current,
  };
}
