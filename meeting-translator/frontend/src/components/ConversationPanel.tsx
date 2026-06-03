import { useEffect, useRef, useState } from "react";
import type { LangCode, Utterance } from "../types";
import type { CaptureMode } from "../hooks/useAudioCapture";
import { useAudioCapture } from "../hooks/useAudioCapture";
import { useRealtimeSession } from "../hooks/useRealtimeSession";
import { exportTranscript, fetchSettings } from "../api";

interface Props {
  provider: string;
}

export default function ConversationPanel({ provider }: Props) {
  const feedRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [sourceLang, setSourceLang] = useState<LangCode>("auto");
  const [targetLang, setTargetLang] = useState<LangCode>("vi");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("screen");
  const [loopbackId, setLoopbackId] = useState("");
  const [includeMic, setIncludeMic] = useState(true);
  const [micId] = useState("");
  const [starting, setStarting] = useState(false);
  const [exportDir, setExportDir] = useState("");

  const audio = useAudioCapture();
  const session = useRealtimeSession();

  useEffect(() => {
    audio.refreshDevices();
    fetchSettings()
      .then((s) => {
        setExportDir(s.export_dir || "");
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

  const loopbackDevices = audio.devices.filter((d) =>
    /stereo mix|loopback|what u hear|monitor|blackhole|vb-audio|cable output|mix/i.test(
      d.label
    )
  );
  const displayDevices =
    loopbackDevices.length > 0 ? loopbackDevices : audio.devices;

  const applyPair = (pair: "vi-ja" | "ja-vi") => {
    if (pair === "vi-ja") {
      setSourceLang("vi");
      setTargetLang("ja");
    } else {
      setSourceLang("ja");
      setTargetLang("vi");
    }
  };

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
      await session.startSession(stream, sourceLang, targetLang, "remote");
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
        <h2>Hội thoại realtime</h2>
        {session.isLive && <span className="badge live">LIVE</span>}
      </div>

      <div className="hint-box">
        <strong>Quay màn hình + dịch:</strong> chọn <em>Quay màn hình</em>, chia sẻ cửa sổ
        Zoom/Teams (bật âm thanh). <strong>Tai nghe:</strong> dùng Stereo Mix / Loopback.
      </div>

      <div className="panel-header">
        <div className="controls-row">
          <button type="button" className="secondary" onClick={() => applyPair("vi-ja")}>
            Việt → 日本語
          </button>
          <button type="button" className="secondary" onClick={() => applyPair("ja-vi")}>
            日本語 → Việt
          </button>
          <label>
            Nguồn
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
            Thêm micro
          </label>
          <label>
            Nói
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
        </div>
        <div className="controls-row">
          {!session.isLive ? (
            <button onClick={handleStart} disabled={starting}>
              {starting ? "Đang bắt đầu…" : "Bắt đầu dịch"}
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
            Xuất văn bản
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
            Hội thoại + bản dịch hiện tại đây. Dịch qua ChatGPT ({provider}).
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
              {u.translation && (
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
