import type { AudioDeviceOption } from "../types";

/** Giá trị dropdown: tự chọn thiết bị hoặc chia sẻ âm thanh Windows. */
export const SYSTEM_AUDIO_AUTO_ID = "";

export function isStereoMixLabel(label: string): boolean {
  return (
    /stereo mix|stereomix|stereo mixer|what u hear|wave out mix|mixed output/i.test(
      label
    ) ||
    /trộn stereo|trộn kênh|khuếch đại stereo|tổng hợp stereo/i.test(label) ||
    /ステレオ ミキサー|ステレオミックス/i.test(label)
  );
}

export function isCableOutputLabel(label: string): boolean {
  return /cable output/i.test(label);
}

/** CABLE Input = playback — không dùng để ghi. */
export function isCableInputLabel(label: string): boolean {
  return /cable input/i.test(label) && !isCableOutputLabel(label);
}

/** Loa phát ảo VB-Cable — không dùng làm tai nghe nghe lại. */
export function isVirtualPlaybackLabel(label: string): boolean {
  return (
    isCableInputLabel(label) ||
    /vb-audio|vb audio|voicemeeter|virtual cable|blackhole/i.test(label)
  );
}

export function isHeadphoneOutputLabel(label: string): boolean {
  const l = label.toLowerCase();
  if (isVirtualPlaybackLabel(label)) return false;
  return /headphone|headset|earphone|tai nghe|イヤホン|ヘッドホン/i.test(l);
}

/** Chọn loa tai nghe thật để nghe lại khi Windows mặc định là CABLE Input. */
export function pickHeadphoneOutputDevice(
  devices: MediaDeviceInfo[]
): MediaDeviceInfo | undefined {
  const outputs = devices.filter((d) => d.kind === "audiooutput");
  if (!outputs.length) return undefined;

  const headphones = outputs.filter((d) => isHeadphoneOutputLabel(d.label));
  if (headphones.length) return headphones[0];

  const physical = outputs.filter((d) => !isVirtualPlaybackLabel(d.label));
  return physical[0];
}

/** VB-Cable, Voicemeeter, BlackHole… */
export function isVirtualLoopbackLabel(label: string): boolean {
  if (isCableInputLabel(label)) return false;
  return (
    /loopback|blackhole|vb-audio|vb audio|cable output|voicemeeter|virtual audio|monitor of|wave link|elgato|steelseries sonar|rec.?order|system audio|wasapi/i.test(
      label
    ) || /realtek.*mix|mix.*realtek/i.test(label)
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
  if (isStereoMixLabel(d.label)) return 1;
  if (isVirtualLoopbackLabel(d.label)) return 2;
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
