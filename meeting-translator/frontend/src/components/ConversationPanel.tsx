import { useEffect, useRef, useState } from "react";
import type { LangCode, Utterance } from "../types";
import { useSessionMode } from "../SessionModeContext";
import { useAppSettings } from "../AppSettingsContext";
import type { CaptureMode } from "../hooks/useAudioCapture";
import { useAudioCapture } from "../hooks/useAudioCapture";
import { useRealtimeSession } from "../hooks/useRealtimeSession";
import {
  exportTranscript,
  exportVideoToFolder,
  getOfflineSttStatus,
  warmupOfflineStt,
} from "../api";
import { copyText } from "../utils/clipboard";
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
  if (status === "loadingWhisper") return tr("loadingWhisper");
  if (status === "loadingWhisperDownload") return tr("loadingWhisperDownload");
  return status;
}

export default function ConversationPanel() {
  const feedRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { sessionMode, setSessionMode, resetToDefaults } = useSessionMode();
  const { tr, exportDir, recordingsDir } = useAppSettings();
  const [sourceLang, setSourceLang] = useState<LangCode>("auto");
  const [targetLang, setTargetLang] = useState<LangCode>("vi");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("screen");
  const [loopbackId, setLoopbackId] = useState("");
  const [includeMic, setIncludeMic] = useState(true);
  const [starting, setStarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const isTranslate = sessionMode === "translate_realtime";
  const audio = useAudioCapture();
  const session = useRealtimeSession();

  const saveTxtDir = exportDir;
  const saveVideoDir = recordingsDir || exportDir;

  useEffect(() => {
    audio.refreshDevices();
  }, []);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [session.utterances]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = audio.getScreenVideoStream();
    if (video && stream) {
      video.srcObject = stream;
      video.play().catch(() => undefined);
    } else if (video) {
      video.srcObject = null;
    }
  }, [session.isLive, captureMode, audio]);

  const loopbackDevices = audio.devices.filter((d) =>
    /stereo mix|loopback|what u hear|monitor|blackhole|vb-audio|cable output|mix/i.test(
      d.label
    )
  );
  const displayDevices =
    loopbackDevices.length > 0 ? loopbackDevices : audio.devices;

  const latestLine = session.utterances.at(-1);

  const handlePlay = async () => {
    setStarting(true);
    audio.clearError();
    session.setStatus("opening");
    try {
      if (!isTranslate) {
        try {
          const st = await getOfflineSttStatus();
          session.setStatus(
            st.bundled === "true" ? "loadingWhisper" : "loadingWhisperDownload"
          );
        } catch {
          session.setStatus("loadingWhisper");
        }
        await warmupOfflineStt();
      }
      const mixMic = captureMode === "screen" ? true : includeMic;
      const stream = await audio.startCapture(
        captureMode,
        loopbackId || displayDevices[0]?.deviceId,
        mixMic
      );
      const videoStream = audio.getCompositeRecordStream();
      await session.startSession(
        stream,
        sourceLang,
        targetLang,
        sessionMode,
        "remote",
        videoStream
      );
    } catch (e) {
      session.setStatus(`error:${friendlyMediaError(e)}`);
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    await session.stopSession(saveTxtDir, saveVideoDir);
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
      setCaptureMode("screen");
      setLoopbackId("");
      setIncludeMic(true);
      setSourceLang("auto");
      setTargetLang("vi");
      await audio.refreshDevices();
      session.setStatus("idle");
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportTxt = async () => {
    if (!session.utterances.length || !saveTxtDir) return;
    try {
      const msg = await exportTranscript(
        session.utterances,
        saveTxtDir,
        `transcript-${Date.now()}.txt`
      );
      session.setStatus(`saved:${msg}`);
    } catch (e) {
      session.setStatus(`error:${(e as Error).message}`);
    }
  };

  const handleExportVideo = async () => {
    if (!session.sessionId || !saveVideoDir) return;
    try {
      const msg = await exportVideoToFolder(
        session.sessionId,
        saveVideoDir,
        `meeting-${Date.now()}.mp4`
      );
      session.setStatus(`saved:${msg}`);
    } catch (e) {
      session.setStatus(`error:${(e as Error).message}`);
    }
  };

  const copyUtterance = async (u: Utterance) => {
    const text = [u.original, isTranslate && u.translation ? u.translation : ""]
      .filter(Boolean)
      .join("\n");
    await copyText(text);
    setCopyMsg(tr("copied"));
    setTimeout(() => setCopyMsg(null), 2000);
  };

  const copyAll = async () => {
    const text = session.utterances
      .map((u) => {
        const lines = [`[${u.original}]`];
        if (isTranslate && u.translation) lines.push(u.translation);
        return lines.join("\n");
      })
      .join("\n\n");
    await copyText(text);
    setCopyMsg(tr("copied"));
    setTimeout(() => setCopyMsg(null), 2000);
  };

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
        {isTranslate ? tr("hintRealtime") : tr("hintTranscript")}
      </div>

      {session.isLive && latestLine && !isTranslate && (
        <div className="live-caption-bar" aria-live="polite">
          <span className="live-caption-label">{tr("liveCaption")}</span>
          <p>{latestLine.original}</p>
        </div>
      )}

      <div className="panel-header">
        <div className="controls-row">
          <label>
            {tr("source")}
            <select
              value={captureMode}
              onChange={(e) => setCaptureMode(e.target.value as CaptureMode)}
            >
              <option value="screen">{tr("sourceScreen")}</option>
              <option value="display">{tr("sourceDisplay")}</option>
              <option value="loopback">{tr("sourceLoopback")}</option>
              <option value="mic">{tr("sourceMic")}</option>
            </select>
          </label>
          {captureMode === "loopback" && (
            <label>
              {tr("device")}
              <select
                value={loopbackId}
                onChange={(e) => setLoopbackId(e.target.value)}
              >
                <option value="">—</option>
                {displayDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {captureMode !== "screen" && (
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
          {isTranslate && (
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
          )}
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
          <button
            type="button"
            className="secondary"
            disabled={session.utterances.length === 0 || !saveTxtDir}
            onClick={() => void handleExportTxt()}
          >
            {tr("exportTxt")}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!session.sessionId || !saveVideoDir}
            onClick={() => void handleExportVideo()}
          >
            {tr("exportVideo")}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={session.utterances.length === 0}
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

      {session.isLive && audio.getScreenVideoStream() && (
        <div className="screen-preview-wrap">
          <video ref={videoRef} className="screen-preview" muted playsInline />
        </div>
      )}

      <div className="conversation-feed" ref={feedRef}>
        {session.utterances.length === 0 ? (
          <p className="empty-hint">
            {isTranslate ? tr("emptyRealtime") : tr("emptyTranscript")}
          </p>
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
              {u.original && <p className="original">{u.original}</p>}
              {isTranslate && u.translation && (
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
