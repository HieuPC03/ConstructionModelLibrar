#!/usr/bin/env bash
# Prepare + build desktop app (Linux AppImage test, or prep for Windows build)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/frontend"
DESKTOP="$ROOT/desktop"

echo "==> Building frontend..."
cd "$FRONTEND"
npm install
npm run build

echo "==> Installing Electron deps..."
cd "$DESKTOP"
npm install

if [[ "${1:-}" == "--win" ]]; then
  echo "==> Building Windows installer (requires wine on Linux)..."
  npm run dist:win
elif [[ "${1:-}" == "--linux" ]] || [[ -z "${1:-}" ]]; then
  echo "==> Building Linux AppImage (smoke test)..."
  npm run dist:linux || echo "Note: AppImage build may need extra deps. Run build-desktop.ps1 on Windows for .exe installer."
else
  echo "Usage: $0 [--linux|--win]"
fi

echo "==> Output: $DESKTOP/dist-installer/"
