import type { LangCode, Utterance } from "./types";

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
};

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/api/settings`);
  if (!res.ok) throw new Error("Không tải được cài đặt");
  return res.json();
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

export async function translateText(
  text: string,
  sourceLang: LangCode,
  targetLang: LangCode
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/translate/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      source_lang: sourceLang === "auto" ? "vi" : sourceLang,
      target_lang: targetLang === "auto" ? "ja" : targetLang,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseApiError(data, "Dịch thất bại"));
  return data.translation as string;
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
  blob: Blob,
  transcript: string
): Promise<void> {
  const form = new FormData();
  form.append("session_id", sessionId);
  form.append("audio", blob, "recording.webm");
  form.append("transcript_json", transcript);
  const res = await fetch(`${API_BASE}/api/recordings/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Lưu bản ghi thất bại");
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
