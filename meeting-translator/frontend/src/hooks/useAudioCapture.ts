import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioDeviceOption } from "../types";
import {
  listLoopbackDeviceOptions,
  orderedLoopbackDevices,
  SYSTEM_AUDIO_AUTO_ID,
} from "../utils/audioDevices";
import {
  startLoopbackMonitor,
  stopLoopbackMonitor,
} from "../utils/loopbackMonitor";
import {
  canUseMediaRecorder,
  friendlyMediaError,
  pickRecordableAudioStream,
  prepareLoopbackRecordStream,
} from "../utils/mediaRecorder";

export type CaptureMode = "loopback" | "mic";

async function listAudioInputs(): Promise<AudioDeviceOption[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "audioinput")
    .map((d) => ({
      deviceId: d.deviceId,
      label: d.label || `Thiết bị ${d.deviceId.slice(0, 8)}…`,
    }));
}

/** Fallback: chia sẻ âm thanh hệ thống Windows (khi VB-Cable chưa cấu hình). */
async function captureSystemAudioViaDisplay(): Promise<MediaStream> {
  const base = {
    video: {
      width: { ideal: 64, max: 320 },
      height: { ideal: 64, max: 180 },
      frameRate: { max: 5 },
    },
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      suppressLocalAudioPlayback: false,
    },
  };

  let display: MediaStream;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({
      ...base,
      systemAudio: "include",
    } as MediaStreamConstraints);
  } catch {
    display = await navigator.mediaDevices.getDisplayMedia(base);
  }

  display.getVideoTracks().forEach((t) => t.stop());

  const audioTracks = display.getAudioTracks();
  if (!audioTracks.length) {
    display.getTracks().forEach((t) => t.stop());
    throw new Error(
      "Không bắt được âm thanh hệ thống. Trong hộp thoại Windows: chọn «Toàn màn hình» và bật «Chia sẻ âm thanh hệ thống»."
    );
  }

  return new MediaStream(audioTracks);
}

const LOOPBACK_CONSTRAINT_TIERS: MediaTrackConstraints[] = [
  {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
  {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 2 },
  },
  {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 2 },
    sampleRate: { ideal: 48000 },
    sampleSize: { ideal: 16 },
  },
];

function ensureLiveAudioTrack(stream: MediaStream): MediaStream {
  const track = stream.getAudioTracks()[0];
  if (!track || track.readyState === "ended") {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("Thiết bị loopback không phát âm thanh. Kiểm tra cấu hình Windows.");
  }
  track.enabled = true;
  return stream;
}

async function openLoopbackDevice(deviceId: string): Promise<MediaStream> {
  let lastErr: unknown;
  for (const tier of LOOPBACK_CONSTRAINT_TIERS) {
    for (const exact of [true, false] as const) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: exact ? { exact: deviceId } : { ideal: deviceId },
            ...tier,
          },
        });
        return ensureLiveAudioTrack(stream);
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function tryOpenLoopbackCandidates(
  candidates: AudioDeviceOption[]
): Promise<MediaStream | null> {
  for (const dev of candidates) {
    try {
      return await openLoopbackDevice(dev.deviceId);
    } catch {
      continue;
    }
  }
  return null;
}

async function resolveLoopbackStream(
  loopbackDeviceId: string | undefined,
  ordered: AudioDeviceOption[]
): Promise<MediaStream | null> {
  if (loopbackDeviceId && loopbackDeviceId !== SYSTEM_AUDIO_AUTO_ID) {
    const picked = ordered.filter((d) => d.deviceId === loopbackDeviceId);
    const fromPicked = await tryOpenLoopbackCandidates(picked);
    if (fromPicked) return fromPicked;

    try {
      return await openLoopbackDevice(loopbackDeviceId);
    } catch {
      /* thử toàn bộ thiết bị loopback khác */
    }
  }

  if (ordered.length > 0) {
    return tryOpenLoopbackCandidates(ordered);
  }

  return null;
}

async function buildLoopbackRecordable(
  loopbackRaw: MediaStream,
  includeMic: boolean,
  audioStreams: MediaStream[]
): Promise<MediaStream> {
  if (!includeMic) {
    try {
      const enhanced = await prepareLoopbackRecordStream(loopbackRaw);
      if (canUseMediaRecorder(enhanced)) {
        return enhanced;
      }
    } catch {
      /* dùng luồng gốc */
    }
    return pickRecordableAudioStream([loopbackRaw]);
  }

  return pickRecordableAudioStream(audioStreams);
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
        if (mode === "loopback") {
          const inputs = await listAudioInputs();
          const ordered = orderedLoopbackDevices(inputs);

          loopbackRawForMonitor = await resolveLoopbackStream(
            loopbackDeviceId,
            ordered
          );

          if (loopbackRawForMonitor) {
            audioStreams.push(loopbackRawForMonitor);
          } else {
            const sys = await captureSystemAudioViaDisplay();
            systemAudioViaDisplayRef.current = true;
            audioStreams.push(sys);
          }
        }

        if (includeMic) {
          try {
            const mic = await navigator.mediaDevices.getUserMedia({
              audio: micDeviceId
                ? { deviceId: { ideal: micDeviceId } }
                : true,
            });
            audioStreams.push(mic);
          } catch (micErr) {
            if (audioStreams.length === 0) throw micErr;
            setError(
              "Không mở được micro — chỉ ghi âm thanh hệ thống. Kiểm tra quyền micro Windows."
            );
          }
        }

        if (mode === "mic" && audioStreams.length === 0) {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStreams.push(mic);
        }

        if (audioStreams.length === 0) {
          throw new Error(
            "Không có nguồn âm thanh. Đặt Windows loa mặc định = CABLE Input (YouTube/Facebook/họp đều ghi được), hoặc dùng «Chỉ micro»."
          );
        }

        streamsRef.current = audioStreams;

        let recordable: MediaStream;
        try {
          if (mode === "loopback" && loopbackRawForMonitor) {
            recordable = await buildLoopbackRecordable(
              loopbackRawForMonitor,
              includeMic,
              audioStreams
            );
          } else {
            recordable = await pickRecordableAudioStream(audioStreams);
          }
        } catch (mixErr) {
          if (audioStreams.length > 1 && loopbackRawForMonitor) {
            recordable = await pickRecordableAudioStream([loopbackRawForMonitor]);
            setError(
              "Chỉ ghi được âm hệ thống (micro không trộn được). Tắt «Thêm micro» nếu không cần giọng bạn."
            );
          } else {
            throw mixErr;
          }
        }

        mixedRef.current = recordable;

        if (
          mode === "loopback" &&
          hearLoopback &&
          loopbackRawForMonitor &&
          !systemAudioViaDisplayRef.current
        ) {
          const vol = includeMic ? 0.85 : 1;
          const monitored = await startLoopbackMonitor(loopbackRawForMonitor, vol);
          if (!monitored) {
            setError(
              "Không tìm thấy tai nghe thật để nghe lại. Vẫn ghi âm thanh hệ thống bình thường."
            );
          }
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
