#!/usr/bin/env bash
# Một lệnh: clone repo + build + copy file cài đặt ra dist/installers
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export OUTPUT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)/dist/installers"
export BRANCH="${BRANCH:-cursor/desktop-installer-6a40}"
bash "$SCRIPT_DIR/auto-build-installer.sh"
echo ""
echo ">>> File cai dat Windows (zip): $OUTPUT_DIR/ImageSplatStudio-Setup-0.1.0.zip"
echo ">>> File cai dat Linux:         $OUTPUT_DIR/ImageSplatStudio-0.1.0.AppImage"
