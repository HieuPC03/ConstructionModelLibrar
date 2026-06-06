import type { AudioDeviceOption } from "../types";

/** Giá trị dropdown: tự chọn thiết bị hoặc chia sẻ âm thanh Windows. */
export const SYSTEM_AUDIO_AUTO_ID = "";

export function isStereoMixLabel(label: string): boolean {
  return /stereo mix|what u hear|wave out mix|mixed output/i.test(label);
}

export function isCableOutputLabel(label: string): boolean {
  return /cable output/i.test(label);
}

/** CABLE Input = playback — không dùng để ghi. */
export function isCableInputLabel(label: string): boolean {
  return /cable input/i.test(label) && !isCableOutputLabel(label);
}

/** VB-Cable, Voicemeeter, BlackHole… */
export function isVirtualLoopbackLabel(label: string): boolean {
  if (isCableInputLabel(label)) return false;
  return /loopback|blackhole|vb-audio|vb audio|cable output|voicemeeter|virtual audio|monitor of|wave link|elgato|steelseries sonar|rec.?order|system audio/i.test(
    label
  );
}

export function isLoopbackDeviceLabel(label: string): boolean {
  return isStereoMixLabel(label) || isVirtualLoopbackLabel(label);
}

export function isLikelyMicrophoneLabel(label: string): boolean {
  const l = label.toLowerCase();
  if (isLoopbackDeviceLabel(label)) return false;
  return /microphone|mic\b|headset|headphone|webcam|array|realtek.*input/i.test(l);
}

function loopbackRank(d: AudioDeviceOption): number {
  if (isCableOutputLabel(d.label)) return 0;
  if (isVirtualLoopbackLabel(d.label) && !isStereoMixLabel(d.label)) return 1;
  if (isStereoMixLabel(d.label)) return 2;
  return 3;
}

/** Danh sách loopback theo thứ tự ưu tiên (CABLE Output trước). */
export function orderedLoopbackDevices(
  devices: AudioDeviceOption[]
): AudioDeviceOption[] {
  return devices
    .filter((d) => isLoopbackDeviceLabel(d.label) && !isCableInputLabel(d.label))
    .sort((a, b) => loopbackRank(a) - loopbackRank(b));
}

export function pickBestLoopbackDevice(
  devices: AudioDeviceOption[]
): AudioDeviceOption | undefined {
  const ordered = orderedLoopbackDevices(devices);
  return ordered[0];
}

export function listLoopbackDeviceOptions(
  devices: AudioDeviceOption[]
): AudioDeviceOption[] {
  return orderedLoopbackDevices(devices);
}

export function deviceOptionLabel(d: AudioDeviceOption): string {
  if (isCableOutputLabel(d.label)) return `${d.label} (VB-Cable — ghi âm)`;
  if (isStereoMixLabel(d.label)) return `${d.label} (Stereo Mix)`;
  if (isVirtualLoopbackLabel(d.label)) return `${d.label} (loopback)`;
  return d.label;
}
