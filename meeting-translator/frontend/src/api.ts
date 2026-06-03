import type { LangCode, TranscriptSegment, Utterance } from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

function parseApiError(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const detail = (err as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return fallback;
}

export async function checkHealth(): Promise<{
  status: string;
  provider: string;
  stt: string;
  api_key_ok?: boolean;
  config_path?: string;
  message?: string | null;
}> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Backend không phản hồi");
  return res.json();
}

export async function getOfflineSttStatus(): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE}/api/stt/offline/status`);
  if (!res.ok) return {};
  return res.json();
}

export async function warmupOfflineStt(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/stt/offline/warmup`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseApiError(data, "Tải Whisper offline thất bại"));
  return (data as { message?: string }).message ?? "OK";
}

export async function testApiKey(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/config/test`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseApiError(data, "Kiểm tra API thất bại"));
  return (data as { message?: string }).message ?? "OK";
}

export type TranslatorProvider = "openai" | "gemini" | "google";

export type SessionMode = "translate_realtime" | "transcript";

export type AppSettings = {
  recordings_dir: string;
  export_dir: string;
  ui_language: "vi" | "ja";
  default_source_lang: LangCode;
  default_target_lang: LangCode;
  meeting_pair: "vi-ja" | "ja-vi";
  translator_provider?: TranslatorProvider;
  session_mode?: SessionMode;
  text_translate_via?: string;
  live_stt_via?: string;
  config_path?: string;
  recordings_dir_active?: string;
  provider?: string;
  theme?: "dark" | "light" | "ocean";
  whisper_offline_model?: string;
  whisper_offline?: Record<string, string>;
};

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/api/settings`);
  if (!res.ok) throw new Error("Không tải được cài đặt");
  return res.json();
}

export const APP_RESET_EVENT = "meeting-translator-reset";

export const TEXT_TRANSLATE_FILL_EVENT = "meeting-translator-fill-text-translate";

export type TextTranslateFillDetail = {
  text: string;
  sourceLang?: LangCode;
  targetLang?: LangCode;
};

/** Đưa nội dung vào ô nhập panel «Dịch văn bản» (Live Caption → Dịch đoạn). */
export function fillTextTranslateInput(detail: TextTranslateFillDetail): void {
  window.dispatchEvent(
    new CustomEvent<TextTranslateFillDetail>(TEXT_TRANSLATE_FILL_EVENT, { detail })
  );
}

export async function resetSettings(): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/api/settings/reset`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseApiError(data, "Đặt lại cài đặt thất bại"));
  return data as AppSettings;
}

export async function updateSettings(
  patch: Partial<AppSettings>
): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/api/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseApiError(data, "Lưu cài đặt thất bại"));
  return data;
}

export type TextTranslateResult = {
  translation: string;
  provider: string;
  notice: string | null;
};

export async function translateText(
  text: string,
  sourceLang: LangCode,
  targetLang: LangCode
): Promise<TextTranslateResult> {
  const res = await fetch(`${API_BASE}/api/translate/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      source_lang: sourceLang === "auto" ? "vi" : sourceLang,
      target_lang: targetLang === "auto" ? "ja" : targetLang,
      session_mode: "transcript",
      use_openai: false,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseApiError(data, "Dịch thất bại"));
  return {
    translation: data.translation as string,
    provider: (data.provider as string) || "Google Translate",
    notice: (data.notice as string | null) ?? null,
  };
}

export function wsUrl(): string {
  const base = import.meta.env.VITE_WS_URL;
  if (base) return base;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host =
    import.meta.env.DEV && !window.desktopApp?.isDesktop
      ? "127.0.0.1:8000"
      : window.location.host;
  return `${proto}//${host}/ws/session`;
}

export async function uploadRecording(
  sessionId: string,
  audioBlob: Blob | null,
  transcript: string,
  videoBlob?: Blob | null
): Promise<void> {
  const form = new FormData();
  form.append("session_id", sessionId);
  form.append("transcript_json", transcript);
  if (audioBlob && audioBlob.size > 0) {
    form.append("audio", audioBlob, "recording-audio.webm");
  }
  if (videoBlob && videoBlob.size > 0) {
    const ext = videoBlob.type.includes("mp4") ? "mp4" : "webm";
    form.append("video", videoBlob, `recording-video.${ext}`);
  }
  const res = await fetch(`${API_BASE}/api/recordings/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Lưu bản ghi thất bại");
}

export async function exportVideoToFolder(
  sessionId: string,
  saveDir: string,
  filename: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/export/video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      save_dir: saveDir || undefined,
      filename,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseApiError(data, "Lưu video thất bại"));
  return (data as { message: string }).message;
}

/** Dịch đoạn Live Caption bằng ChatGPT (OpenAI). */
export async function translateCaptionOpenAI(
  text: string,
  sourceLang: LangCode,
  targetLang: LangCode
): Promise<TextTranslateResult> {
  const src = sourceLang === "auto" ? "vi" : sourceLang;
  const res = await fetch(`${API_BASE}/api/translate/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      source_lang: src,
      target_lang: targetLang,
      use_openai: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseApiError(data, "Dịch thất bại"));
  return {
    translation: data.translation as string,
    provider: (data.provider as string) || "OpenAI",
    notice: (data.notice as string | null) ?? null,
  };
}

export async function exportTranscriptSegments(
  segments: TranscriptSegment[],
  saveDir: string,
  filename: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/export/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      segments: segments.map((s) => ({
        index: s.index,
        original: s.original,
        translation: s.translation,
      })),
      save_dir: saveDir || undefined,
      filename,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseApiError(data, "Xuất file thất bại"));
  return (data as { message: string }).message;
}

export async function exportTranscript(
  utterances: Utterance[],
  saveDir: string,
  filename: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/export/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      utterances,
      save_dir: saveDir || undefined,
      filename,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseApiError(data, "Xuất file thất bại"));
  return (data as { path: string; message: string }).message;
}
