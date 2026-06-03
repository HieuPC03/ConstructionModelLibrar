import { useCallback, useRef, useState } from "react";
import type { LangCode, SessionMode, Speaker, Utterance } from "../types";
import {
  exportTranscript,
  exportVideoToFolder,
  uploadRecording,
  wsUrl,
} from "../api";

const CHUNK_MS = 3000;

function pickVideoMime(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
}

export function useRealtimeSession() {
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [status, setStatus] = useState("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const videoChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkIntervalRef = useRef<number | null>(null);
  const videoMimeRef = useRef("video/webm");

  const appendUtterance = useCallback((u: Utterance) => {
    setUtterances((prev) => [...prev, u]);
  }, []);

  const sendAudioChunk = useCallback(
    (blob: Blob, meta: Record<string, string>) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify(meta));
      ws.send(blob);
    },
    []
  );

  const startChunkPipeline = useCallback(
    (stream: MediaStream, meta: Record<string, string>) => {
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const pump = () => {
        const rec = new MediaRecorder(stream, { mimeType: mime });
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        rec.onstop = () => {
          if (chunks.length > 0) {
            const blob = new Blob(chunks, { type: mime });
            if (blob.size > 800) {
              sendAudioChunk(blob, { ...meta, filename: "chunk.webm" });
            }
          }
        };
        rec.start();
        setTimeout(() => {
          if (rec.state === "recording") rec.stop();
        }, CHUNK_MS);
      };

      pump();
      chunkIntervalRef.current = window.setInterval(pump, CHUNK_MS);
    },
    [sendAudioChunk]
  );

  const startSession = useCallback(
    async (
      stream: MediaStream,
      sourceLang: LangCode,
      targetLang: LangCode,
      sessionMode: SessionMode,
      remoteSpeaker: Speaker,
      videoStream?: MediaStream | null
    ) => {
      setUtterances([]);
      setStatus("connecting");
      streamRef.current = stream;

      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error("WebSocket lỗi"));
        setTimeout(() => reject(new Error("Timeout kết nối")), 8000);
      });

      ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data as string);
        if (data.type === "ready") {
          setSessionId(data.session_id);
          setIsLive(true);
          setStatus(
            sessionMode === "translate_realtime" ? "liveRealtime" : "liveTranscript"
          );
        } else if (data.type === "utterance" && data.original) {
          appendUtterance({
            id: data.id,
            timestamp: data.timestamp,
            speaker: data.speaker,
            original: data.original,
            translation: data.translation,
          });
        } else if (data.type === "error") {
          setStatus(`error:${data.message}`);
        } else if (data.type === "session_saved") {
          setStatus("saved");
        }
      };

      const meta = {
        source_lang: sourceLang,
        target_lang: targetLang,
        session_mode: sessionMode,
        speaker: remoteSpeaker,
      };
      startChunkPipeline(stream, meta);

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      recordChunksRef.current = [];
      const fullRec = new MediaRecorder(stream, { mimeType: mime });
      fullRec.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      fullRec.start(1000);
      recorderRef.current = fullRec;

      if (videoStream && videoStream.getTracks().length > 0) {
        const vm = pickVideoMime();
        videoMimeRef.current = vm;
        videoChunksRef.current = [];
        const vRec = new MediaRecorder(videoStream, { mimeType: vm });
        vRec.ondataavailable = (e) => {
          if (e.data.size > 0) videoChunksRef.current.push(e.data);
        };
        vRec.start(1000);
        videoRecorderRef.current = vRec;
      }
    },
    [appendUtterance, startChunkPipeline]
  );

  const abortSession = useCallback(() => {
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
    recorderRef.current?.stop();
    recorderRef.current = null;
    videoRecorderRef.current?.stop();
    videoRecorderRef.current = null;
    recordChunksRef.current = [];
    videoChunksRef.current = [];
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setSessionId(null);
    setIsLive(false);
    setUtterances([]);
    setStatus("idle");
  }, []);

  const stopSession = useCallback(
    async (exportDir?: string, videoExportDir?: string) => {
      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current);
        chunkIntervalRef.current = null;
      }

      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "end_session" }));
        await new Promise((r) => setTimeout(r, 500));
        ws.close();
      }
      wsRef.current = null;

      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        await new Promise<void>((resolve) => {
          rec.onstop = () => resolve();
          rec.stop();
        });
      }
      recorderRef.current = null;

      const vRec = videoRecorderRef.current;
      if (vRec && vRec.state !== "inactive") {
        await new Promise<void>((resolve) => {
          vRec.onstop = () => resolve();
          vRec.stop();
        });
      }
      videoRecorderRef.current = null;

      const sid = sessionId;
      const audioBlob =
        recordChunksRef.current.length > 0
          ? new Blob(recordChunksRef.current, { type: "audio/webm" })
          : null;
      const videoBlob =
        videoChunksRef.current.length > 0
          ? new Blob(videoChunksRef.current, { type: videoMimeRef.current })
          : null;

      if (sid && (audioBlob?.size || videoBlob?.size)) {
        try {
          await uploadRecording(
            sid,
            audioBlob,
            JSON.stringify(utterances, null, 2),
            videoBlob
          );
          const parts: string[] = [];
          const txtDir = exportDir || videoExportDir;
          if (txtDir && utterances.length > 0) {
            const msg = await exportTranscript(
              utterances,
              txtDir,
              `transcript-${sid.slice(0, 8)}.txt`
            );
            parts.push(msg);
          }
          const vidDir = videoExportDir || exportDir;
          if (vidDir && videoBlob?.size) {
            const ext = videoMimeRef.current.includes("mp4") ? "mp4" : "webm";
            const vmsg = await exportVideoToFolder(
              sid,
              vidDir,
              `meeting-${sid.slice(0, 8)}.${ext}`
            );
            parts.push(vmsg);
          }
          setStatus(parts.length ? `saved:${parts.join("; ")}` : "saved");
        } catch {
          setStatus("saveFailed");
        }
      }

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setIsLive(false);
    },
    [sessionId, utterances]
  );

  return {
    utterances,
    sessionId,
    isLive,
    status,
    startSession,
    stopSession,
    abortSession,
    setStatus,
  };
}
