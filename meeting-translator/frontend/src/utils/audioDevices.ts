import type { AudioDeviceOption } from "../types";

/** Chia sẻ âm thanh hệ thống Windows — không cần VB-Cable (khuyên dùng). */
export const SYSTEM_AUDIO_WINDOWS_SHARE = "__windows_share__";

/** @deprecated Dùng SYSTEM_AUDIO_WINDOWS_SHARE */
export const SYSTEM_AUDIO_AUTO_ID = SYSTEM_AUDIO_WINDOWS_SHARE;

export function isWindowsSystemAudioShare(deviceId: string | undefined): boolean {
  return (
    !deviceId ||
    deviceId === SYSTEM_AUDIO_WINDOWS_SHARE ||
    deviceId === SYSTEM_AUDIO_AUTO_ID
  );
}

export function isStereoMixLabel(label: string): boolean {
  return /stereo mix|what u hear|wave out mix|mixed output/i.test(label);
}

/** VB-Cable, Voicemeeter, BlackHole… — không cần chip Stereo Mix. */
export function isVirtualLoopbackLabel(label: string): boolean {
  return /loopback|blackhole|vb-audio|vb audio|cable output|cable input|voicemeeter|virtual audio|monitor of|wave link|elgato|steelseries sonar|rec.?order|system audio/i.test(
    label
  );
}

export function isLoopbackDeviceLabel(label: string): boolean {
  return isStereoMixLabel(label) || isVirtualLoopbackLabel(label);
}

/** Thiết bị ghi âm thường (micro) — không hiện trong danh sách loopback. */
export function isLikelyMicrophoneLabel(label: string): boolean {
  const l = label.toLowerCase();
  if (isLoopbackDeviceLabel(label)) return false;
  return /microphone|mic\b|headset|headphone|webcam|array|realtek.*input/i.test(l);
}

/**
 * Ưu tiên loopback ảo; Stereo Mix chỉ khi không có lựa chọn khác.
 * Không trả về micro thường.
 */
export function pickBestLoopbackDevice(
  devices: AudioDeviceOption[]
): AudioDeviceOption | undefined {
  const candidates = devices.filter((d) => isLoopbackDeviceLabel(d.label));
  if (!candidates.length) return undefined;

  const virtual = candidates.filter(
    (d) => isVirtualLoopbackLabel(d.label) && !isStereoMixLabel(d.label)
  );
  if (virtual.length) return virtual[0];

  const stereo = candidates.filter((d) => isStereoMixLabel(d.label));
  if (stereo.length) return stereo[0];

  return candidates[0];
}

export function listLoopbackDeviceOptions(
  devices: AudioDeviceOption[]
): AudioDeviceOption[] {
  return devices.filter((d) => isLoopbackDeviceLabel(d.label));
}

export function deviceOptionLabel(d: AudioDeviceOption): string {
  if (isStereoMixLabel(d.label)) return `${d.label} (Stereo Mix)`;
  if (isVirtualLoopbackLabel(d.label)) return `${d.label} (loopback)`;
  return d.label;
}
