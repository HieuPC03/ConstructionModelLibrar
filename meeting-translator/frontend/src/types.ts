export type LangCode = "vi" | "ja" | "en" | "auto";

export type Speaker = "remote" | "local";

export type SessionMode = "translate_realtime" | "transcript";

export interface Utterance {
  id: string;
  timestamp: string;
  speaker: Speaker;
  original: string;
  translation: string;
}

/** Live Caption: một khối văn bản dài (đoạn 1, 2, …). */
export interface TranscriptSegment {
  id: string;
  index: number;
  original: string;
  translation: string;
  translating: boolean;
  closed: boolean;
}

export interface AudioDeviceOption {
  deviceId: string;
  label: string;
}
