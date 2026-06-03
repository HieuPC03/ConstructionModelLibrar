import type { LangCode } from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export async function checkHealth(): Promise<{
  status: string;
  provider: string;
  stt: string;
}> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Backend không phản hồi");
  return res.json();
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? "Dịch thất bại");
  }
  const data = await res.json();
  return data.translation as string;
}

export function wsUrl(): string {
  const base = import.meta.env.VITE_WS_URL;
  if (base) return base;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = import.meta.env.DEV
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
