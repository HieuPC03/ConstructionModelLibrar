#!/usr/bin/env bash
# Embed gradient-orb icon into ImageSplat Studio.exe (Linux cross-build via Wine + rcedit).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP="$ROOT/desktop"
EXE="$DESKTOP/dist-installer/win-unpacked/ImageSplat Studio.exe"
ICO="$DESKTOP/assets/icon.ico"
VERSION="$(node -p "require('$DESKTOP/package.json').version")"

if [[ ! -f "$EXE" ]]; then
  echo "ERROR: Missing $EXE — run electron-builder first."
  exit 1
fi
if [[ ! -f "$ICO" ]]; then
  echo "ERROR: Missing $ICO — run scripts/generate-app-icon.py first."
  exit 1
fi

find_rcedit() {
  find "${HOME}/.cache/electron-builder/winCodeSign" -name 'rcedit-x64.exe' 2>/dev/null | head -1
}

RCEDIT="$(find_rcedit)"
if [[ -z "$RCEDIT" ]]; then
  echo ">> Downloading rcedit (electron-builder winCodeSign)..."
  (cd "$DESKTOP" && CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win dir --config.win.signAndEditExecutable=false 2>/dev/null || true)
  RCEDIT="$(find_rcedit)"
fi
if [[ -z "$RCEDIT" ]]; then
  echo "ERROR: rcedit-x64.exe not found. Run npm run dist:win once in desktop/."
  exit 1
fi

if ! command -v wine >/dev/null 2>&1; then
  echo "ERROR: wine required to embed Windows exe icon on Linux."
  exit 1
fi

export WINEPREFIX="${WINEPREFIX:-$HOME/.wine-rcedit}"
export WINEDLLOVERRIDES="${WINEDLLOVERRIDES:-mscoree,mshtml=}"
export WINEDEBUG="${WINEDEBUG:--all}"

echo ">> Embedding icon into ImageSplat Studio.exe (v$VERSION)..."
wine "$RCEDIT" "$EXE" \
  --set-icon "$ICO" \
  --set-file-version "$VERSION" \
  --set-product-version "$VERSION.0" \
  --set-version-string ProductName "ImageSplat Studio" \
  --set-version-string FileDescription "ImageSplat Studio — 3D Gaussian Splatting" \
  --set-version-string CompanyName "ImageSplat Studio"

if command -v python3 >/dev/null 2>&1; then
  python3 - <<'PY' "$EXE"
import sys
try:
    import pefile
    pe = pefile.PE(sys.argv[1])
    ok = any(e.id == 14 for e in getattr(pe, "DIRECTORY_ENTRY_RESOURCE", type("", (), {"entries": []})()).entries)
    pe.close()
    if not ok:
        raise SystemExit("ICON resource not found after rcedit")
    print(">> Verified: icon embedded in .exe")
except ImportError:
    print(">> Icon embed done (pefile not installed — skip verify)")
PY
fi

echo ">> OK — ImageSplat Studio.exe has custom icon"
