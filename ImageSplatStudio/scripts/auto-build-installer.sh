#!/usr/bin/env bash
# =============================================================================
# ImageSplat Studio — Tự động clone + build file cài đặt
# Chạy trên Linux:  bash scripts/auto-build-installer.sh
# Chạy trên Windows: powershell -ExecutionPolicy Bypass -File scripts/auto-build-installer.ps1
# =============================================================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/HieuPC03/ConstructionModelLibrar.git}"
BRANCH="${BRANCH:-cursor/desktop-installer-6a40}"
WORK_DIR="${WORK_DIR:-/tmp/imagesplat-build}"
OUTPUT_DIR="${OUTPUT_DIR:-$(cd "$(dirname "$0")/.." && pwd)/dist/installers}"

echo "=============================================="
echo " ImageSplat Studio — Auto Build Installer"
echo "=============================================="
echo "Repo:   $REPO_URL"
echo "Branch: $BRANCH"
echo "Output: $OUTPUT_DIR"
echo ""

# Clone or update
if [[ -d "$WORK_DIR/.git" ]]; then
  echo ">> Updating repo..."
  git -C "$WORK_DIR" fetch origin "$BRANCH"
  git -C "$WORK_DIR" checkout "$BRANCH"
  git -C "$WORK_DIR" pull origin "$BRANCH" || true
else
  echo ">> Cloning repo..."
  rm -rf "$WORK_DIR"
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$WORK_DIR"
fi

STUDIO="$WORK_DIR/ImageSplatStudio"
mkdir -p "$OUTPUT_DIR"

# Build frontend
echo ">> Building frontend..."
cd "$STUDIO/frontend"
npm install --silent
npm run build

# Build desktop
echo ">> Building desktop app..."
cd "$STUDIO/desktop"
npm install --silent

OS="$(uname -s)"
if [[ "$OS" == "Linux" ]]; then
  echo ">> Building Linux AppImage..."
  npm run dist:linux
  cp -f dist-installer/*.AppImage "$OUTPUT_DIR/" 2>/dev/null || true

  if command -v wine64 >/dev/null 2>&1 || command -v wine >/dev/null 2>&1; then
    echo ">> Attempting Windows installer (cross-compile via Wine)..."
    npm run dist:win 2>/dev/null && cp -f dist-installer/*.exe "$OUTPUT_DIR/" 2>/dev/null || \
      echo "   Windows .exe skipped (build on Windows for full installer)"
  fi
elif [[ "$OS" == MINGW* ]] || [[ "$OS" == MSYS* ]] || [[ "$OS" == CYGWIN* ]]; then
  echo ">> Run build-desktop.ps1 on Windows instead"
else
  npm run dist:linux || true
fi

# Copy unpacked for reference
if [[ -d "$STUDIO/desktop/dist-installer" ]]; then
  find "$STUDIO/desktop/dist-installer" -maxdepth 1 -type f \( -name "*.exe" -o -name "*.AppImage" -o -name "*.zip" \) \
    -exec cp -f {} "$OUTPUT_DIR/" \;
fi

echo ""
echo "=============================================="
echo " DONE — File cài đặt:"
echo "=============================================="
ls -lh "$OUTPUT_DIR/" 2>/dev/null || echo "(chưa có file — chạy build-desktop.ps1 trên Windows)"
echo ""
echo "Đường dẫn: $OUTPUT_DIR"
