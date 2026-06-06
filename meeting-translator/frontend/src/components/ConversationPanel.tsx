import { useEffect, useRef, useState } from "react";
import { useVadMonitor } from "../hooks/useVadMonitor";
import type { LangCode, TranscriptSegment, Utterance } from "../types";
import { useSessionMode } from "../SessionModeContext";
import { useAppSettings } from "../AppSettingsContext";
import type { CaptureMode } from "../hooks/useAudioCapture";
import { useAudioCapture } from "../hooks/useAudioCapture";
import { useRealtimeSession } from "../hooks/useRealtimeSession";
import {
  checkHealth,
  exportTranscript,
  exportTranscriptSegments,
  fillTextTranslateInput,
  translateCaptionMeeting,
} from "../api";
import { copyText } from "../utils/clipboard";
import LookupableText from "./LookupableText";
import { formatSegmentParagraph } from "../utils/transcriptText";
import { SYSTEM_AUDIO_AUTO_ID, deviceOptionLabel } from "../utils/audioDevices";
import { friendlyMediaError } from "../utils/mediaRecorder";

function statusLabel(
  status: string,
  tr: (k: Parameters<typeof import("../i18n/messages").t>[1]) => string
): string {
  if (status === "idle") return tr("statusIdle");
  if (status === "connecting") return tr("statusConnecting");
  if (status === "liveTranscript") return tr("statusLiveTranscript");
  if (status === "liveRealtime") return tr("statusLiveRealtime");
  if (status.startsWith("error:")) return status.slice(6);
  if (status === "saved") return tr("savedSession");
  if (status.startsWith("saved:")) return status.slice(6);
  if (status === "saveFailed") return tr("saveFailed");
  if (status === "opening") return tr("statusOpeningAudio");
  if (status === "translatingSegment") return tr("translatingSegment");
  return status;
}

export default function ConversationPanel() {
  const feedRef = useRef<HTMLDivElement>(null);
  const { sessionMode, setSessionMode, resetToDefaults } = useSessionMode();
  const { tr, exportDir, recordingsDir } = useAppSettings();
  const [sourceLang, setSourceLang] = useState<LangCode>("ja");
  const [targetLang, setTargetLang] = useState<LangCode>("vi");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("loopback");
  const [loopbackId, setLoopbackId] = useState("");
  const [includeMic, setIncludeMic] = useState(true);
  const [hearLoopback, setHearLoopback] = useState(true);
  const [starting, setStarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);

  const isTranslate = sessionMode === "translate_realtime";
  const audio = useAudioCapture();
  const session = useRealtimeSession();
  const vad = useVadMonitor(captureStream, session.isLive);

  const updateVadMeta = session.updateVadMeta;
  useEffect(() => {
    updateVadMeta(vad);
  }, [vad, updateVadMeta]);

  const exportBaseDir = exportDir || recordingsDir;

  const hasTranscriptContent = session.transcriptSegments.some((s) =>
    s.original.trim()
  );

  useEffect(() => {
    audio.refreshDevices();
  }, []);

  /** Giữ vùng xem ở đầu feed (câu mới trên cùng) — không kéo xuống đáy. */
  useEffect(() => {
    const el = feedRef.current;
    if (!el || !session.isLive) return;
    const nearTop = el.scrollTop < 96;
    if (nearTop) {
      el.scrollTop = 0;
    }
  }, [
    session.isLive,
    session.utterances,
    session.transcriptSegments,
    session.liveDraft,
    session.activeSegment?.liveTail,
    session.activeSegment?.completedSentences,
  ]);

  const loopbackDevices = audio.loopbackDevices;

  const handlePlay = async () => {
    setStarting(true);
    audio.clearError();
    session.setStatus("opening");
    try {
      await checkHealth();
      const stream = await audio.startCapture(
        captureMode,
        captureMode === "loopback" ? loopbackId || SYSTEM_AUDIO_AUTO_ID : undefined,
        includeMic,
        undefined,
        captureMode === "loopback" ? hearLoopback : false
      );
      setCaptureStream(stream);
      await session.startSession(
        stream,
        sourceLang,
        targetLang,
        sessionMode,
        "remote",
        captureMode
      );
    } catch (e) {
      session.setStatus(`error:${friendlyMediaError(e)}`);
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    await session.stopSession(exportBaseDir);
    audio.stopAll();
    setCaptureStream(null);
  };

  const handleRefreshReset = async () => {
    if (session.isLive) {
      if (!window.confirm(tr("confirmReset"))) return;
      session.abortSession();
      audio.stopAll();
      setCaptureStream(null);
    }
    setRefreshing(true);
    try {
      await resetToDefaults();
      setCaptureMode("loopback");
      setLoopbackId("");
      setIncludeMic(true);
      setSourceLang("ja");
      setTargetLang("vi");
      await audio.refreshDevices();
      session.setStatus("idle");
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportTxt = async () => {
    if (!exportBaseDir) {
      session.setStatus(`error:${tr("exportNeedDir")}`);
      return;
    }
    setExportOpen(false);
    try {
      if (isTranslate) {
        if (!session.utterances.length) return;
        const msg = await exportTranscript(
          session.utterances,
          exportBaseDir,
          `transcript-${Date.now()}.txt`
        );
        session.setStatus(`saved:${msg}`);
      } else {
        if (!hasTranscriptContent) return;
        const msg = await exportTranscriptSegments(
          session.transcriptSegments,
          exportBaseDir,
          `transcript-${Date.now()}.txt`
        );
        session.setStatus(`saved:${msg}`);
      }
    } catch (e) {
      session.setStatus(`error:${friendlyMediaError(e)}`);
    }
  };

  const handleTranslateSegment = async (seg: TranscriptSegment) => {
    const text = seg.original.trim();
    if (!text || seg.translating) return;
    fillTextTranslateInput({
      text,
      sourceLang: sourceLang === "auto" ? undefined : sourceLang,
      targetLang,
    });
    session.beginNextSegmentAfterTranslate(seg.id);
    try {
      const result = await translateCaptionMeeting(text, sourceLang, targetLang);
      session.setSegmentTranslation(seg.id, result.translation);
    } catch (e) {
      session.setSegmentTranslateError(seg.id);
      session.setStatus(`error:${(e as Error).message}`);
    }
  };

  const copyAll = async () => {
    let text: string;
    if (isTranslate) {
      text = session.utterances
        .map((u) => {
          const lines = [u.original];
          if (u.translation) lines.push(u.translation);
          return lines.join("\n");
        })
        .join("\n\n");
    } else {
      text = session.transcriptSegments
        .map((s) => {
          const parts = [`=== Đoạn ${s.index} ===`, s.original];
          if (s.translation) parts.push("", s.translation);
          return parts.join("\n");
        })
        .join("\n\n");
    }
    await copyText(text);
    setCopyMsg(tr("copied"));
    setTimeout(() => setCopyMsg(null), 2000);
  };

  const copyUtterance = async (u: Utterance) => {
    const text = [u.original, isTranslate && u.translation ? u.translation : ""]
      .filter(Boolean)
      .join("\n");
    await copyText(text);
    setCopyMsg(tr("copied"));
    setTimeout(() => setCopyMsg(null), 2000);
  };

  const activeSeg = session.activeSegment;
  const canTranslateActive =
    !isTranslate &&
    activeSeg &&
    activeSeg.original.trim().length > 0 &&
    !activeSeg.closed;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{tr("meeting")}</h2>
        {session.isLive && <span className="badge live">{tr("live")}</span>}
      </div>

      <div className="mode-switch">
        <button
          type="button"
          className={!isTranslate ? "mode-btn active" : "mode-btn secondary"}
          onClick={() => setSessionMode("transcript")}
          disabled={session.isLive}
        >
          {tr("modeTranscript")}
        </button>
        <button
          type="button"
          className={isTranslate ? "mode-btn active" : "mode-btn secondary"}
          onClick={() => setSessionMode("translate_realtime")}
          disabled={session.isLive}
        >
          {tr("modeRealtime")}
        </button>
      </div>

      <div className="hint-box">
        {captureMode === "loopback"
          ? tr("hintLoopback")
          : isTranslate
            ? tr("hintRealtime")
            : tr("hintTranscript")}
      </div>

      <div className="panel-header">
        <div className="controls-row">
          <label>
            {tr("source")}
            <select
              value={captureMode}
              onChange={(e) => setCaptureMode(e.target.value as CaptureMode)}
            >
              <option value="loopback">{tr("sourceLoopback")}</option>
              <option value="mic">{tr("sourceMic")}</option>
            </select>
          </label>
          {captureMode === "loopback" && (
            <>
              <label>
                {tr("device")}
                <select
                  value={loopbackId}
                  onChange={(e) => setLoopbackId(e.target.value)}
                >
                  <option value={SYSTEM_AUDIO_AUTO_ID}>
                    {tr("systemAudioAuto")}
                  </option>
                  {loopbackDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {deviceOptionLabel(d)}
                    </option>
                  ))}
                </select>
              </label>
              <label title={tr("hearLoopbackHint")}>
                <input
                  type="checkbox"
                  checked={hearLoopback}
                  onChange={(e) => setHearLoopback(e.target.checked)}
                />
                {tr("hearLoopback")}
              </label>
            </>
          )}
          <label>
            <input
              type="checkbox"
              checked={includeMic}
              onChange={(e) => setIncludeMic(e.target.checked)}
            />
            {tr("addMic")}
          </label>
          <label>
            {tr("spokenLang")}
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value as LangCode)}
            >
              <option value="ja">日本語</option>
              <option value="vi">Tiếng Việt</option>
            </select>
          </label>
          <label>
            {tr("translateTo")}
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value as LangCode)}
            >
              <option value="vi">Tiếng Việt</option>
              <option value="ja">日本語</option>
            </select>
          </label>
        </div>
        <div className="controls-row">
          {!session.isLive ? (
            <button
              className="play-btn"
              onClick={() => void handlePlay()}
              disabled={starting}
            >
              {starting ? tr("starting") : tr("play")}
            </button>
          ) : (
            <button className="danger stop-btn" onClick={() => void handleStop()}>
              {tr("stop")}
            </button>
          )}
          {!isTranslate && session.isLive && (
            <button
              type="button"
              className="secondary"
              disabled={!canTranslateActive}
              onClick={() =>
                activeSeg && void handleTranslateSegment(activeSeg)
              }
            >
              {tr("translateSegment")}
            </button>
          )}
          <div className="export-dropdown">
            <button
              type="button"
              className="secondary"
              disabled={
                ((!hasTranscriptContent && !isTranslate) ||
                  (isTranslate && session.utterances.length === 0)) &&
                !session.sessionId
              }
              onClick={() => setExportOpen((o) => !o)}
            >
              {tr("exportData")} ▾
            </button>
            {exportOpen && (
              <div className="export-menu">
                <button
                  type="button"
                  disabled={
                    isTranslate
                      ? session.utterances.length === 0
                      : !hasTranscriptContent
                  }
                  onClick={() => void handleExportTxt()}
                >
                  {tr("exportAsTxt")}
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="secondary"
            disabled={
              isTranslate
                ? session.utterances.length === 0
                : !hasTranscriptContent
            }
            onClick={() => void copyAll()}
          >
            {tr("copyAll")}
          </button>
          <button
            className="secondary"
            type="button"
            disabled={refreshing || starting}
            onClick={() => void handleRefreshReset()}
          >
            {refreshing ? tr("refreshing") : tr("refreshReset")}
          </button>
        </div>
      </div>

      {session.isLive && (
        <div className="live-caption-strip" aria-live="polite">
          <div className="live-caption-strip-header">
            <span className="badge live small">{tr("listeningNow")}</span>
            <span className="live-caption-hint">{tr("liveStripHint")}</span>
          </div>
          {isTranslate ? (
            session.liveDraft ? (
              <LookupableText
                text={session.liveDraft}
                className="live-caption-stream"
                sourceLang={sourceLang}
                targetLang={targetLang}
              />
            ) : (
              <p className="live-caption-stream">
                <span className="live-waiting">{tr("waitingSpeech")}</span>
              </p>
            )
          ) : (
            (() => {
              const liveText = formatSegmentParagraph(
                session.activeSegment?.original ||
                  session.activeSegment?.liveTail ||
                  ""
              );
              return liveText ? (
                <LookupableText
                  text={liveText}
                  className="live-caption-stream"
                  sourceLang={sourceLang}
                  targetLang={targetLang}
                />
              ) : (
                <p className="live-caption-stream">
                  <span className="live-waiting">{tr("waitingSpeech")}</span>
                </p>
              );
            })()
          )}
        </div>
      )}

      <div
        className={`conversation-feed${session.isLive ? " is-live" : ""}`}
        ref={feedRef}
      >
        {!isTranslate ? (
          session.transcriptSegments.length === 0 ? (
            <p className="empty-hint">{tr("emptyTranscript")}</p>
          ) : (
            session.transcriptSegments.map((seg) => (
              <article
                key={seg.id}
                className={`transcript-segment ${seg.closed ? "closed" : "active"} ${
                  !seg.closed && session.isLive ? "recording" : ""
                }`}
              >
                <div className="segment-header">
                  <span className="segment-label">
                    {tr("segment")} {seg.index}
                    {!seg.closed && session.isLive && (
                      <span className="badge live small">{tr("recordingNow")}</span>
                    )}
                    {seg.translating && (
                      <span className="segment-status">{tr("translatingSegment")}</span>
                    )}
                  </span>
                  {seg.closed && seg.original.trim() && (
                    <button
                      type="button"
                      className="secondary copy-inline"
                      onClick={() => void copyText(seg.original)}
                    >
                      {tr("copy")}
                    </button>
                  )}
                </div>
                {seg.original.trim() ? (
                  <LookupableText
                    text={formatSegmentParagraph(seg.original)}
                    className="segment-original segment-paragraph"
                    sourceLang={sourceLang}
                    targetLang={targetLang}
                    editable={!session.isLive || seg.closed}
                    onEditCommit={(wrong, fixed) =>
                      session.updateSegmentOriginal(seg.id, wrong, fixed)
                    }
                  />
                ) : (
                  <p className="empty-hint segment-placeholder">
                    {tr("segmentRecording")}
                  </p>
                )}
                {seg.translation && (
                  <LookupableText
                    text={seg.translation}
                    className="segment-translation"
                    sourceLang={targetLang}
                    targetLang={sourceLang}
                  />
                )}
              </article>
            ))
          )
        ) : session.utterances.length === 0 && !session.liveDraft ? (
          <p className="empty-hint">{tr("emptyRealtime")}</p>
        ) : (
          session.utterances.map((u: Utterance) => (
            <article
              key={u.id}
              className={`utterance ${u.speaker === "local" ? "local" : ""}`}
            >
              <div className="meta">
                <span>
                  {u.speaker === "local" ? tr("you") : tr("meetingSpeaker")} ·{" "}
                  {new Date(u.timestamp).toLocaleTimeString()}
                </span>
                <button
                  type="button"
                  className="secondary copy-inline"
                  onClick={() => void copyUtterance(u)}
                >
                  {tr("copy")}
                </button>
              </div>
              {u.original && (
                <LookupableText
                  text={u.original}
                  className="original"
                  sourceLang={sourceLang}
                  targetLang={targetLang}
                />
              )}
              {u.translation && (
                <LookupableText
                  text={u.translation}
                  className="translation"
                  sourceLang={targetLang}
                  targetLang={sourceLang}
                />
              )}
            </article>
          ))
        )}
      </div>

      <div
        className={`status-bar ${session.status.startsWith("error:") || audio.error ? "error" : ""}`}
      >
        <span className="status-bar-main">
          {statusLabel(session.status, tr)}
          {session.sessionId && ` · ${session.sessionId.slice(0, 8)}`}
          {audio.error &&
            !session.status.startsWith("error:") &&
            ` · ${audio.error}`}
          {copyMsg && ` · ${copyMsg}`}
        </span>
        <span className="dev-credit">Developed by PTH</span>
      </div>
    </section>
  );
}
