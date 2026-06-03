export type LangCode = "vi" | "ja" | "en" | "auto";

export type Speaker = "remote" | "local";

export interface Utterance {
  id: string;
  timestamp: string;
  speaker: Speaker;
  original: string;
  translation: string;
}

export interface AudioDeviceOption {
  deviceId: string;
  label: string;
}
