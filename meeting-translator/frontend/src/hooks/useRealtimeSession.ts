import { useCallback, useRef, useState } from "react";
import type { LangCode, Speaker, Utterance } from "../types";
import { exportTranscript, uploadRecording, wsUrl } from "../api";

const CHUNK_MS = 3000;

export function useRealtimeSession() {
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [status, setStatus] = useState("Chưa bắt đầu");
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkIntervalRef = useRef<number | null>(null);

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
              sendAudioChunk(blob, {
                ...meta,
                filename: "chunk.webm",
              });
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
      remoteSpeaker: Speaker
    ) => {
      setUtterances([]);
      setStatus("Đang kết nối…");
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
          setStatus("Đang dịch realtime");
        } else if (data.type === "utterance" && data.original) {
          appendUtterance({
            id: data.id,
            timestamp: data.timestamp,
            speaker: data.speaker,
            original: data.original,
            translation: data.translation,
          });
        } else if (data.type === "error") {
          setStatus(`Lỗi: ${data.message}`);
        } else if (data.type === "session_saved") {
          setStatus("Đã lưu phiên");
        }
      };

      const meta = {
        source_lang: sourceLang,
        target_lang: targetLang,
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
    },
    [appendUtterance, startChunkPipeline]
  );

  const stopSession = useCallback(async (exportDir?: string) => {
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

    const sid = sessionId;
    if (sid && recordChunksRef.current.length > 0) {
      const blob = new Blob(recordChunksRef.current, { type: "audio/webm" });
      try {
        await uploadRecording(
          sid,
          blob,
          JSON.stringify(utterances, null, 2)
        );
        let msg = "Đã lưu âm thanh + hội thoại";
        if (exportDir && utterances.length > 0) {
          await exportTranscript(
            utterances,
            exportDir,
            `transcript-${sid.slice(0, 8)}.txt`
          );
          msg += `; văn bản → ${exportDir}`;
        }
        setStatus(msg);
      } catch {
        setStatus("Lưu bản ghi thất bại (kiểm tra thư mục lưu)");
      }
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsLive(false);
  }, [sessionId, utterances]);

  return {
    utterances,
    sessionId,
    isLive,
    status,
    startSession,
    stopSession,
    setStatus,
  };
}
