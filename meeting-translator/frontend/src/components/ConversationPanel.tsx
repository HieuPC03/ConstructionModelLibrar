import { useEffect, useRef, useState } from "react";
import type { LangCode, SessionMode, Utterance } from "../types";
import type { CaptureMode } from "../hooks/useAudioCapture";
import { useAudioCapture } from "../hooks/useAudioCapture";
import { useRealtimeSession } from "../hooks/useRealtimeSession";
import { exportTranscript, fetchSettings, updateSettings } from "../api";

export default function ConversationPanel() {
  const feedRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [sessionMode, setSessionMode] = useState<SessionMode>("transcript");
  const [sourceLang, setSourceLang] = useState<LangCode>("auto");
  const [targetLang, setTargetLang] = useState<LangCode>("vi");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("screen");
  const [loopbackId, setLoopbackId] = useState("");
  const [includeMic, setIncludeMic] = useState(true);
  const [micId] = useState("");
  const [starting, setStarting] = useState(false);
  const [exportDir, setExportDir] = useState("");

  const isTranslate = sessionMode === "translate_realtime";
  const audio = useAudioCapture();
  const session = useRealtimeSession();

  useEffect(() => {
    audio.refreshDevices();
    fetchSettings()
      .then((s) => {
        setExportDir(s.export_dir || s.recordings_dir || "");
        setSessionMode(s.session_mode || "transcript");
        if (s.meeting_pair === "ja-vi") {
          setSourceLang("ja");
          setTargetLang("vi");
        } else {
          setSourceLang(s.default_source_lang || "auto");
          setTargetLang(s.default_target_lang || "vi");
        }
      })
      .catch(() => undefined);
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

  const onModeChange = async (mode: SessionMode) => {
    setSessionMode(mode);
    await updateSettings({ session_mode: mode }).catch(() => undefined);
  };

  const loopbackDevices = audio.devices.filter((d) =>
    /stereo mix|loopback|what u hear|monitor|blackhole|vb-audio|cable output|mix/i.test(
      d.label
    )
  );
  const displayDevices =
    loopbackDevices.length > 0 ? loopbackDevices : audio.devices;

  const handleStart = async () => {
    setStarting(true);
    session.setStatus("Đang mở nguồn âm thanh…");
    try {
      const mixMic =
        captureMode === "screen" ? true : includeMic;
      const stream = await audio.startCapture(
        captureMode,
        loopbackId || displayDevices[0]?.deviceId,
        mixMic,
        micId || undefined
      );
      await session.startSession(
        stream,
        sourceLang,
        targetLang,
        sessionMode,
        "remote"
      );
    } catch (e) {
      session.setStatus((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    await session.stopSession(exportDir);
    audio.stopAll();
  };

  const handleExport = async () => {
    if (session.utterances.length === 0) return;
    try {
      const msg = await exportTranscript(
        session.utterances,
        exportDir,
        `transcript-${Date.now()}.txt`
      );
      session.setStatus(msg);
    } catch (e) {
      session.setStatus((e as Error).message);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Phiên họp</h2>
        {session.isLive && <span className="badge live">LIVE</span>}
      </div>

      <div className="mode-switch">
        <button
          type="button"
          className={isTranslate ? "mode-btn active" : "mode-btn secondary"}
          onClick={() => onModeChange("translate_realtime")}
          disabled={session.isLive}
        >
          Dịch realtime · ChatGPT
        </button>
        <button
          type="button"
          className={!isTranslate ? "mode-btn active" : "mode-btn secondary"}
          onClick={() => onModeChange("transcript")}
          disabled={session.isLive}
        >
          Ghi transcript · Gemini
        </button>
      </div>

      <div className="hint-box">
        {isTranslate ? (
          <>
            <strong>Dịch realtime:</strong> nhận dạng + dịch qua <em>ChatGPT (OpenAI)</em>.
            Cần OPENAI_API_KEY + billing.
          </>
        ) : (
          <>
            <strong>Ghi transcript:</strong> chỉ ghi chữ qua <em>Gemini</em>; dịch thủ công
            bên phải cũng dùng Gemini. Cần GEMINI_API_KEY (AIza...).
          </>
        )}
        {" "}
        <strong>Quay màn hình:</strong> tự trộn âm <em>loa/tai nghe + micro</em>.
      </div>

      <div className="panel-header">
        <div className="controls-row">
          <label>
            Nguồn
            <select
              value={captureMode}
              onChange={(e) => setCaptureMode(e.target.value as CaptureMode)}
            >
              <option value="screen">Quay màn hình (loa + micro)</option>
              <option value="display">Chia sẻ tab / màn hình</option>
              <option value="loopback">Loopback / Stereo Mix</option>
              <option value="mic">Chỉ micro</option>
            </select>
          </label>
          {captureMode === "loopback" && (
            <label>
              Thiết bị
              <select
                value={loopbackId}
                onChange={(e) => setLoopbackId(e.target.value)}
              >
                <option value="">— Chọn —</option>
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
              Thêm micro
            </label>
          )}
          <label>
            Ngôn ngữ nói
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value as LangCode)}
            >
              <option value="auto">Tự động</option>
              <option value="vi">Tiếng Việt</option>
              <option value="ja">日本語</option>
              <option value="en">English</option>
            </select>
          </label>
          {isTranslate && (
            <label>
              Dịch sang
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
            <button onClick={handleStart} disabled={starting}>
              {starting
                ? "Đang bắt đầu…"
                : isTranslate
                  ? "Bắt đầu dịch realtime"
                  : "Bắt đầu ghi transcript"}
            </button>
          ) : (
            <button className="danger" onClick={handleStop}>
              Dừng & lưu
            </button>
          )}
          <button
            type="button"
            className="secondary"
            disabled={session.utterances.length === 0}
            onClick={handleExport}
          >
            Xuất .txt
          </button>
          <button className="secondary" type="button" onClick={audio.refreshDevices}>
            Làm mới thiết bị
          </button>
        </div>
      </div>

      {session.isLive && captureMode === "screen" && (
        <div className="screen-preview-wrap">
          <video ref={videoRef} className="screen-preview" muted playsInline />
        </div>
      )}

      <div className="conversation-feed" ref={feedRef}>
        {session.utterances.length === 0 ? (
          <p className="empty-hint">
            {isTranslate
              ? "Câu gốc + bản dịch (ChatGPT) hiện tại đây."
              : "Transcript (Gemini) hiện tại đây."}
          </p>
        ) : (
          session.utterances.map((u: Utterance) => (
            <article
              key={u.id}
              className={`utterance ${u.speaker === "local" ? "local" : ""}`}
            >
              <div className="meta">
                {u.speaker === "local" ? "Bạn" : "Cuộc họp"} ·{" "}
                {new Date(u.timestamp).toLocaleTimeString()}
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
        className={`status-bar ${audio.error || session.status.includes("Lỗi") || session.status.includes("API") ? "error" : ""}`}
      >
        {session.status}
        {session.sessionId && ` · Phiên: ${session.sessionId.slice(0, 8)}`}
        {audio.error && ` · ${audio.error}`}
      </div>
    </section>
  );
}
