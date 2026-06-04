import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type {
  LangCode,
  SessionMode,
  Speaker,
  TranscriptSegment,
  Utterance,
} from "../types";
import {
  exportTranscript,
  exportTranscriptSegments,
  exportVideoToFolder,
  uploadRecording,
  wsUrl,
} from "../api";
import {
  createMediaRecorder,
  tryCreateVideoRecorder,
} from "../utils/mediaRecorder";

const CHUNK_MS = 3000;
const MODE_TRANSCRIPT: SessionMode = "transcript";

function newSegment(index: number): TranscriptSegment {
  return {
    id: crypto.randomUUID(),
    index,
    original: "",
    translation: "",
    translating: false,
    closed: false,
  };
}

function appendChunkText(prev: string, chunk: string): string {
  const t = chunk.trim();
  if (!t) return prev;
  if (!prev.trim()) return t;
  const needsSpace = !prev.endsWith(" ") && !/^[,.;:!?)]/.test(t);
  return needsSpace ? `${prev} ${t}` : `${prev}${t}`;
}

export function useRealtimeSession() {
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>(
    []
  );
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
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
  const audioMimeRef = useRef("audio/webm");
  const videoMimeRef = useRef("video/webm");
  const sessionModeRef = useRef<SessionMode>("transcript");
  const openSegmentIdRef = useRef<string | null>(null);
  const chunkMetaRef = useRef<Record<string, string>>({});
  const chunkStreamRef = useRef<MediaStream | null>(null);

  const resetTranscript = useCallback(() => {
    const first = newSegment(1);
    openSegmentIdRef.current = first.id;
    setTranscriptSegments([first]);
    setActiveSegmentId(first.id);
  }, []);

  const appendUtterance = useCallback((u: Utterance) => {
    setUtterances((prev) => [...prev, u]);
  }, []);

  const appendTranscriptChunk = useCallback((text: string) => {
    setTranscriptSegments((prev) => {
      let list = prev;
      let openId = openSegmentIdRef.current;
      let open = openId ? list.find((s) => s.id === openId && !s.closed) : undefined;
      if (!open) {
        open = list.find((s) => !s.closed);
      }
      if (!open) {
        const nextIndex = list.length
          ? Math.max(...list.map((s) => s.index)) + 1
          : 1;
        const seg = newSegment(nextIndex);
        openId = seg.id;
        openSegmentIdRef.current = openId;
        setActiveSegmentId(openId);
        list = [...list, seg];
        open = seg;
      } else {
        openId = open.id;
        openSegmentIdRef.current = openId;
      }
      return list.map((s) =>
        s.id === openId
          ? { ...s, original: appendChunkText(s.original, text) }
          : s
      );
    });
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
      const pump = () => {
        try {
          const { recorder: rec, mimeType } = createMediaRecorder(stream);
          const chunks: Blob[] = [];
          rec.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };
          rec.onstop = () => {
            if (chunks.length > 0) {
              const blob = new Blob(chunks, { type: mimeType });
              if (blob.size > 800) {
                const ext = mimeType.includes("ogg") ? "chunk.ogg" : "chunk.webm";
                sendAudioChunk(blob, { ...meta, filename: ext });
              }
            }
          };
          rec.start();
          setTimeout(() => {
            if (rec.state === "recording") rec.stop();
          }, CHUNK_MS);
        } catch {
          /* skip chunk */
        }
      };

      const { mimeType } = createMediaRecorder(stream);
      audioMimeRef.current = mimeType;
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
      sessionModeRef.current = sessionMode;
      setUtterances([]);
      flushSync(() => {
        resetTranscript();
      });
      setStatus("connecting");
      streamRef.current = stream;

      const meta = {
        source_lang: sourceLang,
        target_lang: targetLang,
        session_mode: sessionMode,
        speaker: remoteSpeaker,
      };
      chunkMetaRef.current = meta;
      chunkStreamRef.current = stream;

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
          const chunkStream = chunkStreamRef.current;
          if (chunkStream && !chunkIntervalRef.current) {
            startChunkPipeline(chunkStream, chunkMetaRef.current);
          }
        } else if (data.type === "utterance" && data.original) {
          if (sessionModeRef.current === MODE_TRANSCRIPT) {
            appendTranscriptChunk(data.original);
          } else {
            appendUtterance({
              id: data.id,
              timestamp: data.timestamp,
              speaker: data.speaker,
              original: data.original,
              translation: data.translation || "",
            });
          }
        } else if (data.type === "error") {
          setStatus(`error:${data.message}`);
        } else if (data.type === "session_saved") {
          setStatus("saved");
        }
      };

      recordChunksRef.current = [];
      const { recorder: fullRec, mimeType } = createMediaRecorder(stream);
      audioMimeRef.current = mimeType;
      fullRec.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      fullRec.start(1000);
      recorderRef.current = fullRec;

      if (videoStream && videoStream.getTracks().length > 0) {
        const videoRec = tryCreateVideoRecorder(videoStream);
        if (videoRec) {
          videoMimeRef.current = videoRec.mimeType;
          videoChunksRef.current = [];
          videoRec.recorder.ondataavailable = (e) => {
            if (e.data.size > 0) videoChunksRef.current.push(e.data);
          };
          videoRec.recorder.start(1000);
          videoRecorderRef.current = videoRec.recorder;
        }
      }
    },
    [appendUtterance, appendTranscriptChunk, resetTranscript, startChunkPipeline]
  );

  const beginNextSegmentAfterTranslate = useCallback((segmentId: string) => {
    setTranscriptSegments((prev) => {
      const nextIndex = prev.length ? Math.max(...prev.map((s) => s.index)) + 1 : 1;
      const seg = newSegment(nextIndex);
      openSegmentIdRef.current = seg.id;
      setActiveSegmentId(seg.id);
      return [
        ...prev.map((s) =>
          s.id === segmentId ? { ...s, closed: true, translating: true } : s
        ),
        seg,
      ];
    });
  }, []);

  const setSegmentTranslation = useCallback(
    (segmentId: string, translation: string) => {
      setTranscriptSegments((prev) =>
        prev.map((s) =>
          s.id === segmentId
            ? { ...s, translation, translating: false }
            : s
        )
      );
    },
    []
  );

  const setSegmentTranslateError = useCallback((segmentId: string) => {
    setTranscriptSegments((prev) =>
      prev.map((s) =>
        s.id === segmentId ? { ...s, translating: false } : s
      )
    );
  }, []);

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
    setTranscriptSegments([]);
    setActiveSegmentId(null);
    openSegmentIdRef.current = null;
    chunkStreamRef.current = null;
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
          ? new Blob(recordChunksRef.current, { type: audioMimeRef.current })
          : null;
      const videoBlob =
        videoChunksRef.current.length > 0
          ? new Blob(videoChunksRef.current, { type: videoMimeRef.current })
          : null;

      const transcriptJson =
        sessionModeRef.current === MODE_TRANSCRIPT
          ? JSON.stringify({ segments: transcriptSegments }, null, 2)
          : JSON.stringify(utterances, null, 2);

      if (sid && (audioBlob?.size || videoBlob?.size)) {
        try {
          await uploadRecording(sid, audioBlob, transcriptJson, videoBlob);
        } catch {
          /* ignore */
        }
      }

      const txtDir = exportDir || videoExportDir;
      const parts: string[] = [];
      try {
        if (txtDir) {
          if (
            sessionModeRef.current === MODE_TRANSCRIPT &&
            transcriptSegments.some((s) => s.original.trim())
          ) {
            const msg = await exportTranscriptSegments(
              transcriptSegments,
              txtDir,
              `transcript-${sid?.slice(0, 8) || Date.now()}.txt`
            );
            parts.push(msg);
          } else if (utterances.length > 0) {
            const msg = await exportTranscript(
              utterances,
              txtDir,
              `transcript-${sid?.slice(0, 8) || Date.now()}.txt`
            );
            parts.push(msg);
          }
        }
        const vidDir = videoExportDir || exportDir;
        if (vidDir && videoBlob?.size && sid) {
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

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setIsLive(false);
    },
    [sessionId, utterances, transcriptSegments]
  );

  const activeSegment =
    transcriptSegments.find((s) => s.id === activeSegmentId) ??
    transcriptSegments.find((s) => !s.closed);

  return {
    utterances,
    transcriptSegments,
    activeSegment,
    activeSegmentId,
    sessionId,
    isLive,
    status,
    startSession,
    stopSession,
    abortSession,
    setStatus,
    beginNextSegmentAfterTranslate,
    setSegmentTranslation,
    setSegmentTranslateError,
  };
}
