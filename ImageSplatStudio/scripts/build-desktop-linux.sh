#!/usr/bin/env bash
# Full offline Windows desktop build on Linux (with exe icon via Wine+rcedit).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP="$ROOT/desktop"
FRONTEND="$ROOT/frontend"
DIST="$ROOT/dist/installers"
VERSION="$(node -p "require('$DESKTOP/package.json').version")"
ZIP="$DIST/ImageSplatStudio-${VERSION}-win-offline.zip"

echo "==> ImageSplat Studio Linux → Windows build (v$VERSION)"

echo ">> Clean stale artifacts..."
rm -rf "$FRONTEND/dist" "$FRONTEND/node_modules/.vite" "$DESKTOP/dist-installer"

echo ">> Frontend..."
(cd "$FRONTEND" && npm install --silent && npm run build)

echo ">> App icons..."
python3 "$ROOT/scripts/generate-app-icon.py"

echo ">> Bundle Windows Python..."
bash "$ROOT/scripts/bundle-windows-python.sh"

echo ">> Bundle ODA File Converter (DWG import)..."
bash "$ROOT/scripts/bundle-oda-converter.sh"

echo ">> Electron package..."
(cd "$DESKTOP" && npm install --silent)
export CSC_IDENTITY_AUTO_DISCOVERY=false
(cd "$DESKTOP" && npm run dist:win -- --config.win.signAndEditExecutable=false) || {
  # NSIS may fail on Linux; win-unpacked is enough
  test -f "$DESKTOP/dist-installer/win-unpacked/ImageSplat Studio.exe" || exit 1
}

echo ">> Embed .exe icon..."
bash "$ROOT/scripts/embed-windows-icon.sh"

mkdir -p "$DIST"
rm -f "$ZIP"
echo "ImageSplat Studio v$VERSION" > "$DESKTOP/dist-installer/win-unpacked/VERSION.txt"
echo "Built: $(date -u +%Y-%m-%dT%H:%MZ)" >> "$DESKTOP/dist-installer/win-unpacked/VERSION.txt"
(cd "$DESKTOP/dist-installer/win-unpacked" && zip -r -q "$ZIP" .)

bash "$ROOT/scripts/verify-build-version.sh" "$ZIP"

echo ""
echo "==> DONE: $ZIP ($(du -h "$ZIP" | cut -f1))"
echo "    ImageSplat Studio.exe has gradient orb icon"
