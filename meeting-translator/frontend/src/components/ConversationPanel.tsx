import { useEffect, useRef, useState } from "react";
import type { LangCode, Utterance } from "../types";
import type { CaptureMode } from "../hooks/useAudioCapture";
import { useAudioCapture } from "../hooks/useAudioCapture";
import { useRealtimeSession } from "../hooks/useRealtimeSession";

interface Props {
  provider: string;
}

export default function ConversationPanel({ provider }: Props) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [sourceLang, setSourceLang] = useState<LangCode>("auto");
  const [targetLang, setTargetLang] = useState<LangCode>("vi");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("loopback");
  const [loopbackId, setLoopbackId] = useState("");
  const [includeMic, setIncludeMic] = useState(true);
  const [micId] = useState("");
  const [starting, setStarting] = useState(false);

  const audio = useAudioCapture();
  const session = useRealtimeSession();

  useEffect(() => {
    audio.refreshDevices();
  }, []);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [session.utterances]);

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
      await session.startSession(stream, sourceLang, targetLang, "remote");
    } catch (e) {
      session.setStatus((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    await session.stopSession();
    audio.stopAll();
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Hội thoại realtime</h2>
        {session.isLive && <span className="badge live">LIVE</span>}
      </div>

      <div className="hint-box">
        <strong>Tai nghe, không cần micro cuộc họp:</strong> chọn nguồn{" "}
        <em>Stereo Mix / Loopback</em> (Windows) hoặc <em>Monitor of …</em>{" "}
        (Linux) để bắt âm thanh phát ra loa/tai nghe từ Zoom/Teams. Bật{" "}
        <em>Thêm micro của bạn</em> để ghi cả phần bạn nói khi trả lời.
        Hoặc dùng <em>Chia sẻ tab cuộc họp</em> nếu họp trên trình duyệt.
      </div>

      <div className="panel-header">
        <div className="controls-row">
          <label>
            Nguồn âm
            <select
              value={captureMode}
              onChange={(e) =>
                setCaptureMode(e.target.value as CaptureMode)
              }
            >
              <option value="loopback">Loopback / Stereo Mix</option>
              <option value="display">Chia sẻ tab / màn hình</option>
              <option value="mic">Chỉ micro (không khuyến nghị)</option>
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
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="vi">Tiếng Việt</option>
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
          <button className="secondary" type="button" onClick={audio.refreshDevices}>
            Làm mới thiết bị
          </button>
        </div>
      </div>

      <div className="conversation-feed" ref={feedRef}>
        {session.utterances.length === 0 ? (
          <p className="empty-hint">
            Văn bản hội thoại và bản dịch sẽ hiện tại đây khi có âm thanh từ
            cuộc họp. Provider: {provider}.
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
        className={`status-bar ${audio.error || session.status.includes("Lỗi") ? "error" : ""}`}
      >
        {session.status}
        {session.sessionId && ` · Phiên: ${session.sessionId.slice(0, 8)}`}
        {audio.error && ` · ${audio.error}`}
      </div>
    </section>
  );
}
