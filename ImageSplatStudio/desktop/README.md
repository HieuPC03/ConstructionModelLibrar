# ImageSplat Studio — Desktop App

Ứng dụng cài đặt PC (Windows) cho ImageSplat Studio — Point Cloud & Ảnh → 3D Gaussian.

## Build installer Windows (.exe)

**Yêu cầu:** Windows 10/11, Node.js 20+, kết nối internet (lần build đầu)

```powershell
cd ImageSplatStudio
.\build-desktop.ps1
```

File cài đặt: `desktop/dist-installer/ImageSplatStudio-Setup-0.1.0.exe`

### Tùy chọn

```powershell
# Installer nhỏ hơn — dùng Python có sẵn trên máy user
.\build-desktop.ps1 -SkipPythonBundle
```

## Cài đặt cho người dùng

1. Chạy `ImageSplatStudio-Setup-0.1.0.exe`
2. Chọn thư mục cài đặt → Next → Install
3. Mở **ImageSplat Studio** từ Desktop hoặc Start Menu
4. App tự khởi động backend + mở giao diện 3D

Dữ liệu (jobs, uploads) lưu tại:
- Windows: `%APPDATA%\imagesplat-studio-desktop\data\`

## Dev mode (chạy desktop không build installer)

```bash
# Terminal 1 — build frontend trước
cd frontend && npm install && npm run build

# Terminal 2 — chạy Electron
cd desktop && npm install && npm start
```

Cần Python 3.10+ và `pip install -r backend/requirements.txt`.

## Linux (test AppImage)

```bash
./build-desktop.sh --linux
```

## Kiến trúc

```
desktop/
├── electron/main.cjs    # Khởi động Python backend + cửa sổ app
├── package.json         # electron-builder config
└── python/              # Python embeddable (Windows build script tạo)
```

Electron đóng gói:
- Frontend (React build)
- Backend (FastAPI)
- Pipeline scripts (Open3D, 3DGS)
- Python runtime (Windows, nếu không skip bundle)
