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
  openSessionWebSocket,
  uploadRecording,
} from "../api";
import {
  applyChunkToSegmentText,
  splitCompletedSentences,
} from "../utils/transcriptText";
import type { CaptureMode } from "./useAudioCapture";
import {
  chunkFilenameForMime,
  createMediaRecorder,
  friendlyMediaError,
  resumeStreamAudioContext,
} from "../utils/mediaRecorder";

const MODE_TRANSCRIPT: SessionMode = "transcript";
const MODE_REALTIME: SessionMode = "translate_realtime";

/** Live Caption — độ trễ ~1s/chunk. */
const CHUNK_MS_TRANSCRIPT = 1000;
/** Dịch realtime — độ trễ ~0.8s/chunk. */
const CHUNK_MS_REALTIME = 800;

function chunkMsForMode(mode: SessionMode): number {
  return mode === MODE_REALTIME ? CHUNK_MS_REALTIME : CHUNK_MS_TRANSCRIPT;
}

/** Chunk nhỏ hơn vẫn gửi STT (micro / loopback). */
const MIN_CHUNK_BYTES = 160;

function isSentenceComplete(text: string): boolean {
  const t = text.trim();
  return t.length >= 2 && /[.?!。．？！…]$/.test(t);
}

function newSegment(index: number): TranscriptSegment {
  return {
    id: crypto.randomUUID(),
    index,
    original: "",
    completedSentences: [],
    liveTail: "",
    translation: "",
    translating: false,
    closed: false,
  };
}

function appendChunkText(prev: string, chunk: string): string {
  return applyChunkToSegmentText(prev, chunk);
}

function withSplitSentences(
  original: string,
  extra?: Partial<TranscriptSegment>
): Pick<TranscriptSegment, "original" | "completedSentences" | "liveTail"> {
  const { completedSentences, liveTail } = splitCompletedSentences(original);
  return { original, completedSentences, liveTail, ...extra };
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
  /** Dải live: dịch realtime — câu đang gom trước khi dịch xong. */
  const [liveDraft, setLiveDraft] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const chunkPumpIntervalRef = useRef<number | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioMimeRef = useRef("audio/webm");
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

  const appendRealtimeUtterance = useCallback((u: Utterance) => {
    setUtterances((prev) => {
      if (
        prev.length === 0 ||
        isSentenceComplete(prev[prev.length - 1].original)
      ) {
        return [...prev, u];
      }
      const last = prev[prev.length - 1];
      return [
        ...prev.slice(0, -1),
        {
          ...last,
          id: u.id,
          timestamp: u.timestamp,
          original: appendChunkText(last.original, u.original),
          translation: u.translation || last.translation,
        },
      ];
    });
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
      return list.map((s) => {
        if (s.id !== openId) return s;
        const original = appendChunkText(s.original, text);
        return { ...s, ...withSplitSentences(original) };
      });
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

  const clearChunkPump = useCallback(() => {
    if (chunkPumpIntervalRef.current) {
      clearInterval(chunkPumpIntervalRef.current);
      chunkPumpIntervalRef.current = null;
    }
  }, []);

  /** Gộp blob hoàn chỉnh mỗi chunk (~0.75s) — Whisper cần file webm hợp lệ. */
  const startLiveAudioRecording = useCallback(
    (stream: MediaStream, meta: Record<string, string>) => {
      if (chunkPumpIntervalRef.current) return;
      recordChunksRef.current = [];
      const chunkMs = chunkMsForMode(sessionModeRef.current);

      const pump = () => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        try {
          const { recorder: rec, mimeType } = createMediaRecorder(stream);
          audioMimeRef.current = mimeType;
          const slices: Blob[] = [];
          rec.ondataavailable = (e) => {
            if (e.data.size > 0) slices.push(e.data);
          };
          rec.onstop = () => {
            if (!slices.length) return;
            const blob = new Blob(slices, { type: mimeType });
            if (blob.size < MIN_CHUNK_BYTES) return;
            recordChunksRef.current.push(blob);
            sendAudioChunk(blob, {
              ...meta,
              filename: chunkFilenameForMime(mimeType),
            });
          };
          rec.onerror = () => {
            setStatus("error:MediaRecorder lỗi khi ghi âm từ nguồn này");
          };
          rec.start();
          window.setTimeout(() => {
            if (rec.state === "recording") rec.stop();
          }, chunkMs);
        } catch (e) {
          setStatus(`error:${friendlyMediaError(e)}`);
        }
      };

      pump();
      chunkPumpIntervalRef.current = window.setInterval(pump, chunkMs);
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
      captureMode: CaptureMode = "loopback"
    ) => {
      sessionModeRef.current = sessionMode;
      setUtterances([]);
      setLiveDraft("");
      flushSync(() => {
        resetTranscript();
      });
      setStatus("connecting");
      streamRef.current = stream;
      await resumeStreamAudioContext(stream);

      const meta = {
        source_lang: sourceLang,
        target_lang: targetLang,
        session_mode: sessionMode,
        speaker: remoteSpeaker,
        capture_mode: captureMode,
      };
      chunkMetaRef.current = meta;
      chunkStreamRef.current = stream;

      const ws = await openSessionWebSocket();
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data as string);
        if (data.type === "ready") {
          setSessionId(data.session_id);
          setIsLive(true);
          setStatus(
            sessionMode === "translate_realtime" ? "liveRealtime" : "liveTranscript"
          );
          const chunkStream = chunkStreamRef.current;
          if (chunkStream) {
            try {
              startLiveAudioRecording(chunkStream, chunkMetaRef.current);
            } catch (e) {
              setStatus(`error:${friendlyMediaError(e)}`);
            }
          }
        } else if (data.type === "partial" && data.original) {
          if (sessionModeRef.current === MODE_REALTIME) {
            setLiveDraft(String(data.original));
          }
        } else if (data.type === "utterance" && data.original) {
          if (sessionModeRef.current === MODE_TRANSCRIPT) {
            appendTranscriptChunk(data.original);
          } else if (sessionModeRef.current === MODE_REALTIME) {
            setLiveDraft("");
            appendRealtimeUtterance({
              id: data.id,
              timestamp: data.timestamp,
              speaker: data.speaker,
              original: data.original,
              translation: data.translation || "",
            });
          }
        } else if (data.type === "utterance_translation" && data.id) {
          setUtterances((prev) =>
            prev.map((u) =>
              u.id === data.id
                ? { ...u, translation: String(data.translation || "") }
                : u
            )
          );
        } else if (data.type === "error") {
          setStatus(`error:${data.message}`);
        } else if (data.type === "session_saved") {
          setStatus("saved");
        }
      };

    },
    [appendRealtimeUtterance, appendTranscriptChunk, resetTranscript, startLiveAudioRecording]
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
    clearChunkPump();
    wsRef.current?.close();
    wsRef.current = null;
    recordChunksRef.current = [];
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setSessionId(null);
    setIsLive(false);
    setUtterances([]);
    setLiveDraft("");
    setTranscriptSegments([]);
    setActiveSegmentId(null);
    openSegmentIdRef.current = null;
    chunkStreamRef.current = null;
    setStatus("idle");
  }, [clearChunkPump]);

  const stopSession = useCallback(async (exportDir?: string) => {
      clearChunkPump();
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "end_session" }));
        await new Promise((r) => setTimeout(r, 500));
        ws.close();
      }
      wsRef.current = null;

      const sid = sessionId;
      const audioBlob =
        recordChunksRef.current.length > 0
          ? new Blob(recordChunksRef.current, { type: audioMimeRef.current })
          : null;
      const transcriptJson =
        sessionModeRef.current === MODE_TRANSCRIPT
          ? JSON.stringify({ segments: transcriptSegments }, null, 2)
          : JSON.stringify(utterances, null, 2);

      if (sid && audioBlob?.size) {
        try {
          await uploadRecording(sid, audioBlob, transcriptJson, null);
        } catch {
          /* ignore */
        }
      }

      const parts: string[] = [];
      try {
        if (exportDir) {
          if (
            sessionModeRef.current === MODE_TRANSCRIPT &&
            transcriptSegments.some((s) => s.original.trim())
          ) {
            const msg = await exportTranscriptSegments(
              transcriptSegments,
              exportDir,
              `transcript-${sid?.slice(0, 8) || Date.now()}.txt`
            );
            parts.push(msg);
          } else if (utterances.length > 0) {
            const msg = await exportTranscript(
              utterances,
              exportDir,
              `transcript-${sid?.slice(0, 8) || Date.now()}.txt`
            );
            parts.push(msg);
          }
        }
        setStatus(parts.length ? `saved:${parts.join("; ")}` : "saved");
      } catch {
        setStatus("saveFailed");
      }

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setIsLive(false);
    },
    [sessionId, utterances, transcriptSegments, clearChunkPump]
  );

  const activeSegment =
    transcriptSegments.find((s) => s.id === activeSegmentId) ??
    transcriptSegments.find((s) => !s.closed);

  return {
    utterances,
    transcriptSegments,
    activeSegment,
    activeSegmentId,
    liveDraft,
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
