# Meeting Realtime Translator

Ứng dụng dịch **cuộc họp realtime** với giao diện chia đôi màn hình: một nửa hiển thị hội thoại + ghi âm, một nửa dịch văn bản Việt ↔ Nhật.

## Tính năng

| Yêu cầu | Cách triển khai |
|--------|------------------|
| Dịch khi vẫn đeo tai nghe, không cần micro cuộc họp | Bắt **âm thanh hệ thống (loopback)**: Stereo Mix (Windows), Monitor of … (Linux), hoặc chia sẻ tab Zoom/Teams trên trình duyệt |
| Nửa màn hình hội thoại + ghi âm | Cột trái: dòng thoại gốc + bản dịch; **Record** gộp âm cuộc họp + micro của bạn (tùy chọn) |
| ChatGPT hoặc Gemini | `TRANSLATOR_PROVIDER=openai` hoặc `gemini` trong `backend/.env` |
| Gõ văn bản Việt ↔ Nhật | Cột phải: nhập text, nút Việt→Nhật / Nhật→Việt |

**STT (nhận dạng giọng nói):** OpenAI Whisper (cần `OPENAI_API_KEY`).

## Đường dẫn & file cài đặt

| Mục | Đường dẫn |
|-----|-----------|
| Thư mục app (trong repo) | `meeting-translator/` |
| **File zip cài đặt** | `meeting-translator/dist/Meeting-Translator-v1.0.0.zip` |
| Hướng dẫn tiếng Việt | `meeting-translator/HUONG_DAN_CAI_DAT.txt` |
| Cài lần đầu (Windows) | `install.bat` → sau đó `CHAY.bat` |
| Cài lần đầu (Linux/Mac) | `./install.sh` → `./start.sh` |
| API key | `meeting-translator/backend/.env` |
| Bản ghi đã lưu | `meeting-translator/backend/recordings/` |

Tạo lại gói zip: `./pack-release.sh` (Linux) hoặc `.\pack-release.ps1` (Windows).

## Cài đặt nhanh

**Windows:** Giải nén zip → chạy `install.bat` → sửa `backend\.env` → chạy `CHAY.bat`

**Linux/Mac:**

```bash
cd meeting-translator
cp backend/.env.example backend/.env
# Sửa backend/.env: OPENAI_API_KEY và/hoặc GEMINI_API_KEY

chmod +x start.sh install.sh
./install.sh
./start.sh
```

Mở trình duyệt: **http://127.0.0.1:5173**

### Chạy thủ công

```bash
# Terminal 1 — backend
cd meeting-translator/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd meeting-translator/frontend
npm install && npm run dev
```

## Cấu hình API

`backend/.env`:

```env
TRANSLATOR_PROVIDER=openai   # hoặc gemini
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

- **OpenAI:** Whisper STT + GPT dịch (`gpt-4o-mini` mặc định).
- **Gemini:** chỉ dịch văn bản; STT vẫn dùng Whisper (OpenAI key).

## Bắt âm thanh khi đeo tai nghe

### Windows

1. Cài [VB-Audio Cable](https://vb-audio.com/Cable/) hoặc bật **Stereo Mix** trong Sound → Recording.
2. Trong app Zoom/Teams: output = loa bình thường (tai nghe).
3. Trong Meeting Translator: chọn thiết bị **Stereo Mix** hoặc **CABLE Output** làm nguồn loopback.

### Linux (PipeWire/PulseAudio)

1. Trong app chọn thiết bị có tên **Monitor of …** (âm phát ra tai nghe).
2. Hoặc dùng `pavucontrol` → Recording → chọn monitor của sink đang phát.

### Cuộc họp trên trình duyệt

Chọn nguồn **Chia sẻ tab / màn hình**, tick **Share tab audio** — không cần Stereo Mix.

### Ghi cả người nói và người nghe

Bật **Thêm micro (bạn nói)** — app trộn loopback (tiếng họp) + micro (tiếng bạn) vào một bản ghi.

## Lưu bản ghi

Khi bấm **Dừng & lưu**:

- `backend/recordings/<session_id>/recording.webm` — âm thanh đầy đủ
- `transcript.json` — lịch sử câu thoại + dịch

## Kiến trúc

```
Browser (React)
  ├─ Loopback / Display capture → MediaRecorder chunks (3s)
  ├─ WebSocket /ws/session → Whisper STT → GPT/Gemini dịch
  └─ REST /api/translate/text → dịch văn bản Việt↔Nhật

FastAPI backend
```

## Lưu ý

- Cần **HTTPS hoặc localhost** để trình duyệt cho phép capture âm thanh.
- Độ trễ dịch ~3–6 giây (chunk Whisper 3 giây). Có thể giảm `CHUNK_MS` trong `useRealtimeSession.ts` (tốn API hơn).
- Không lưu API key trong frontend; chỉ đặt trên server.

## Giấy phép

MIT — dùng tự do cho mục đích cá nhân / nội bộ.
