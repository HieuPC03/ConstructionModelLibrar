import { useEffect, useRef, useState } from "react";
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
  translateCaptionOpenAI,
} from "../api";
import { copyText } from "../utils/clipboard";
import {
  deviceOptionLabel,
  isWindowsSystemAudioShare,
  SYSTEM_AUDIO_WINDOWS_SHARE,
} from "../utils/audioDevices";
import { friendlyMediaError } from "../utils/mediaRecorder";
import { langBadge } from "../utils/langLabel";

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
  const [sourceLang, setSourceLang] = useState<LangCode>("auto");
  const [targetLang, setTargetLang] = useState<LangCode>("vi");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("system");
  const [loopbackId, setLoopbackId] = useState(SYSTEM_AUDIO_WINDOWS_SHARE);
  const [includeMic, setIncludeMic] = useState(false);
  const [hearLoopback, setHearLoopback] = useState(true);
  const [starting, setStarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const isTranslate = sessionMode === "translate_realtime";
  const audio = useAudioCapture();
  const session = useRealtimeSession();

  const exportBaseDir = exportDir || recordingsDir;

  const hasTranscriptContent = session.transcriptSegments.some((s) =>
    s.original.trim()
  );

  useEffect(() => {
    audio.refreshDevices();
  }, []);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [
    session.utterances,
    session.transcriptSegments,
    session.liveDraft,
    session.liveDetectedLang,
    session.activeSegment?.liveTail,
    session.activeSegment?.completedSentences,
  ]);

  const loopbackDevices = audio.loopbackDevices;

  const applyPresetMicViJa = () => {
    setCaptureMode("mic");
    setIncludeMic(true);
    setSourceLang("vi");
    setTargetLang("ja");
    setSessionMode("translate_realtime");
  };

  const handlePlay = async () => {
    setStarting(true);
    audio.clearError();
    session.setStatus("opening");
    try {
      await checkHealth();
      const mixMic = captureMode === "mic" || includeMic;
      const loopDevice =
        captureMode === "loopback" || captureMode === "system"
          ? captureMode === "system"
            ? SYSTEM_AUDIO_WINDOWS_SHARE
            : loopbackId
          : undefined;
      const useVbCable =
        captureMode === "loopback" && !isWindowsSystemAudioShare(loopbackId);
      const stream = await audio.startCapture(
        captureMode,
        loopDevice,
        mixMic,
        undefined,
        useVbCable && hearLoopback
      );
      await session.startSession(
        stream,
        sourceLang,
        targetLang,
        sessionMode,
        captureMode === "mic" ? "local" : "remote"
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
  };

  const handleRefreshReset = async () => {
    if (session.isLive) {
      if (!window.confirm(tr("confirmReset"))) return;
      session.abortSession();
      audio.stopAll();
    }
    setRefreshing(true);
    try {
      await resetToDefaults();
      setCaptureMode("system");
      setLoopbackId(SYSTEM_AUDIO_WINDOWS_SHARE);
      setIncludeMic(false);
      setSourceLang("auto");
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
      const result = await translateCaptionOpenAI(text, sourceLang, targetLang);
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

  const showAutoHint = sourceLang === "auto";

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
        <button
          type="button"
          className="mode-btn secondary preset-btn"
          onClick={applyPresetMicViJa}
          disabled={session.isLive}
          title={tr("presetMicViJa")}
        >
          {tr("presetMicViJa")}
        </button>
      </div>

      <div className="hint-box">
        {captureMode === "system"
          ? tr("hintSystemNoCable")
          : captureMode === "loopback"
            ? tr("hintLoopback")
            : isTranslate
              ? tr("hintRealtime")
              : tr("hintTranscript")}
        {showAutoHint && (
          <p className="hint-sub">{tr("autoLangHint")}</p>
        )}
      </div>

      <div className="panel-header">
        <div className="controls-row">
          <label>
            {tr("source")}
            <select
              value={captureMode}
              onChange={(e) => setCaptureMode(e.target.value as CaptureMode)}
            >
              <option value="system">{tr("sourceSystemNoCable")}</option>
              <option value="loopback">{tr("sourceLoopbackVb")}</option>
              <option value="mic">{tr("sourceMic")}</option>
            </select>
          </label>
          {captureMode === "loopback" && (
            <>
              <label>
                {tr("loopbackMethod")}
                <select
                  value={loopbackId}
                  onChange={(e) => setLoopbackId(e.target.value)}
                >
                  <option value={SYSTEM_AUDIO_WINDOWS_SHARE}>
                    {tr("systemAudioNoCable")}
                  </option>
                  {loopbackDevices.length > 0 && (
                    <optgroup label={tr("loopbackDevicesGroup")}>
                      {loopbackDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {deviceOptionLabel(d)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              {!isWindowsSystemAudioShare(loopbackId) && (
                <label title={tr("hearLoopbackHint")}>
                  <input
                    type="checkbox"
                    checked={hearLoopback}
                    onChange={(e) => setHearLoopback(e.target.checked)}
                  />
                  {tr("hearLoopback")}
                </label>
              )}
            </>
          )}
          {captureMode !== "mic" && (
            <label>
              <input
                type="checkbox"
                checked={includeMic}
                onChange={(e) => setIncludeMic(e.target.checked)}
              />
              {tr("addMic")}
            </label>
          )}
          <label>
            {tr("spokenLang")}
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value as LangCode)}
            >
              <option value="auto">{tr("auto")}</option>
              <option value="vi">Tiếng Việt</option>
              <option value="ja">日本語</option>
              <option value="en">English</option>
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
              <option value="en">English</option>
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
                (isTranslate
                  ? session.utterances.length === 0
                  : !hasTranscriptContent) && !session.sessionId
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
            {sourceLang === "auto" && session.liveDetectedLang && (
              <span className="lang-badge" title={tr("langDetected")}>
                {langBadge(session.liveDetectedLang)}
              </span>
            )}
            <span className="live-caption-hint">{tr("liveStripHint")}</span>
          </div>
          <p className="live-caption-stream">
            {isTranslate
              ? session.liveDraft || (
                  <span className="live-waiting">{tr("waitingSpeech")}</span>
                )
              : session.activeSegment?.liveTail ||
                (session.activeSegment && !session.activeSegment.closed
                  ? session.activeSegment.original
                  : "") || (
                  <span className="live-waiting">{tr("waitingSpeech")}</span>
                )}
          </p>
        </div>
      )}

      <div className="conversation-feed" ref={feedRef}>
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
                    {sourceLang === "auto" && seg.detectedLang && (
                      <span className="lang-badge">{langBadge(seg.detectedLang)}</span>
                    )}
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
                {seg.completedSentences.length > 0 ? (
                  <div className="segment-sentences">
                    {seg.completedSentences.map((sent, i) => (
                      <p key={`${seg.id}-s-${i}`} className="segment-sentence">
                        {sent}
                      </p>
                    ))}
                  </div>
                ) : seg.closed && seg.original ? (
                  <p className="segment-original">{seg.original}</p>
                ) : (
                  seg.closed && (
                    <p className="empty-hint segment-placeholder">
                      {tr("segmentRecording")}
                    </p>
                  )
                )}
                {!seg.closed &&
                  seg.completedSentences.length === 0 &&
                  !seg.liveTail && (
                    <p className="empty-hint segment-placeholder">
                      {tr("segmentRecording")}
                    </p>
                  )}
                {seg.translation && (
                  <p className="segment-translation">{seg.translation}</p>
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
                  {sourceLang === "auto" && u.detectedLang && (
                    <>
                      {" "}
                      · <span className="lang-badge">{langBadge(u.detectedLang)}</span>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  className="secondary copy-inline"
                  onClick={() => void copyUtterance(u)}
                >
                  {tr("copy")}
                </button>
              </div>
              {u.original && <p className="original">{u.original}</p>}
              {u.translation && (
                <p className="translation">{u.translation}</p>
              )}
            </article>
          ))
        )}
      </div>

      <div
        className={`status-bar ${session.status.startsWith("error:") || audio.error ? "error" : ""}`}
      >
        {statusLabel(session.status, tr)}
        {session.sessionId && ` · ${session.sessionId.slice(0, 8)}`}
        {audio.error &&
          !session.status.startsWith("error:") &&
          ` · ${audio.error}`}
        {copyMsg && ` · ${copyMsg}`}
      </div>
    </section>
  );
}
