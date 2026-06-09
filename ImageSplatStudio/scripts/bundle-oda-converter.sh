#!/usr/bin/env bash
# Download and extract ODA File Converter for bundling in the desktop installer.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/desktop/ODAFileConverter"
VERSION="${ODA_VERSION:-27.1}"
MSI_NAME="ODAFileConverter_QT6_vc16_amd64dll_${VERSION}.msi"
MSI_URL="https://www.opendesign.com/guestfiles/get?filename=${MSI_NAME}"
# winget manifest ODA.ODAFileConverter 27.1.0
EXPECTED_SHA256="${ODA_MSI_SHA256:-3D5961F510CF95F398B8E2920899DC8E8C51ADECDAF5B20A40B3D1A29269DE81}"

echo "==> Bundle ODA File Converter (v${VERSION})"

if [[ -f "$DEST/ODAFileConverter.exe" ]]; then
  echo ">> Already bundled at $DEST"
  du -sh "$DEST"
  exit 0
fi

MSI="${ODA_MSI_PATH:-/tmp/${MSI_NAME}}"
if [[ ! -f "$MSI" ]]; then
  echo ">> Downloading ${MSI_NAME}..."
  curl -fsSL -L \
    -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
    -H "Referer: https://www.opendesign.com/guestfiles/oda_file_converter" \
    -o "$MSI" \
    "$MSI_URL"
fi

if command -v sha256sum >/dev/null 2>&1 && [[ -n "$EXPECTED_SHA256" ]]; then
  ACTUAL="$(sha256sum "$MSI" | awk '{print toupper($1)}')"
  if [[ "$ACTUAL" != "$(echo "$EXPECTED_SHA256" | tr '[:lower:]' '[:upper:]')" ]]; then
    echo "WARN: MSI SHA256 mismatch (got $ACTUAL)" >&2
  fi
fi

if ! command -v msiextract >/dev/null 2>&1; then
  echo "ERROR: msiextract not found. Install msitools (Linux) or run bundle-oda-converter.ps1 on Windows." >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST"
echo ">> Extracting MSI..."
msiextract -C "$DEST" "$MSI"

if [[ ! -f "$DEST/ODAFileConverter.exe" ]]; then
  echo "ERROR: ODAFileConverter.exe not found after extract" >&2
  exit 1
fi

echo ">> ODA bundled: $(du -sh "$DEST" | cut -f1) ($(find "$DEST" -type f | wc -l) files)"
