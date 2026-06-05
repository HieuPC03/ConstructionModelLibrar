#!/usr/bin/env bash
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP="$ROOT/desktop"
PYTHON_DIR="$DESKTOP/python"
BACKEND="$ROOT/backend"
PYTHON_VERSION="3.11.9"
PYTHON_ZIP="python-${PYTHON_VERSION}-embed-amd64.zip"
PYTHON_URL="https://www.python.org/ftp/python/${PYTHON_VERSION}/${PYTHON_ZIP}"

echo "==> Bundle Windows Python (offline app)"
rm -rf "$PYTHON_DIR"
mkdir -p "$PYTHON_DIR"

echo ">> Download embeddable Python..."
curl -fsSL "$PYTHON_URL" -o "/tmp/${PYTHON_ZIP}"
unzip -qo "/tmp/${PYTHON_ZIP}" -d "$PYTHON_DIR"

PTH="$(ls "$PYTHON_DIR"/python*._pth | head -1)"
sed -i 's/#import site/import site/' "$PTH"
sed -i 's/# import site/import site/' "$PTH"
grep -q 'Lib\\site-packages' "$PTH" || printf '\nLib\\site-packages\n' >> "$PTH"
mkdir -p "$PYTHON_DIR/Lib/site-packages"

echo ">> Install pip packages (Windows wheels)..."
pip3 install --upgrade pip -q
pip3 install \
  --target "$PYTHON_DIR/Lib/site-packages" \
  --platform win_amd64 \
  --python-version 311 \
  --only-binary=:all: \
  --prefer-binary \
  -r "$BACKEND/requirements.txt"

echo ">> Python bundle size: $(du -sh "$PYTHON_DIR" | cut -f1)"
test -f "$PYTHON_DIR/python.exe"
test -d "$PYTHON_DIR/Lib/site-packages/uvicorn"
echo ">> OK — Windows Python bundled"
