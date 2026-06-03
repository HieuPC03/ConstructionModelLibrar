import { useEffect, useRef, useState } from "react";
import type { LangCode, Utterance } from "../types";
import type { CaptureMode } from "../hooks/useAudioCapture";
import { useAudioCapture } from "../hooks/useAudioCapture";
import { useRealtimeSession } from "../hooks/useRealtimeSession";
import { exportTranscript, fetchSettings } from "../api";

export default function ConversationPanel() {
  const feedRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [sourceLang, setSourceLang] = useState<LangCode>("auto");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("screen");
  const [loopbackId, setLoopbackId] = useState("");
  const [includeMic, setIncludeMic] = useState(false);
  const [micId] = useState("");
  const [starting, setStarting] = useState(false);
  const [exportDir, setExportDir] = useState("");

  const audio = useAudioCapture();
  const session = useRealtimeSession();

  useEffect(() => {
    audio.refreshDevices();
    fetchSettings()
      .then((s) => {
        setExportDir(s.export_dir || s.recordings_dir || "");
        setSourceLang(s.default_source_lang || "auto");
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
      const stream = await audio.startCapture(
        captureMode,
        loopbackId || displayDevices[0]?.deviceId,
        includeMic,
        micId || undefined
      );
      await session.startSession(stream, sourceLang, "remote");
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
    <section className="panel panel-full">
      <div className="panel-header">
        <h2>Ghi chữ trực tiếp (phụ đề / transcript)</h2>
        {session.isLive && <span className="badge live">ĐANG GHI</span>}
      </div>

      <div className="hint-box">
        <strong>Chỉ ghi văn bản</strong> — không dịch realtime. Bắt lời từ cuộc họp (tai nghe /
        quay màn hình) và lưu thành file .txt. Cần <em>GEMINI_API_KEY</em> (AIza...) trong .env
        để nhận dạng giọng nói.
      </div>

      <div className="panel-header">
        <div className="controls-row">
          <label>
            Nguồn âm
            <select
              value={captureMode}
              onChange={(e) => setCaptureMode(e.target.value as CaptureMode)}
            >
              <option value="screen">Quay màn hình + âm thanh</option>
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
                <option value="">— Chọn thiết bị —</option>
                {displayDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <input
              type="checkbox"
              checked={includeMic}
              onChange={(e) => setIncludeMic(e.target.checked)}
            />
            Thêm micro (bạn nói)
          </label>
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
        </div>
        <div className="controls-row">
          {!session.isLive ? (
            <button onClick={handleStart} disabled={starting}>
              {starting ? "Đang bắt đầu…" : "Bắt đầu ghi chữ"}
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
            Xuất file .txt
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
            Văn bản cuộc họp hiện tại đây khi có âm thanh (giống phụ đề Win+Ctrl+L).
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
