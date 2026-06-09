#!/usr/bin/env bash
# Verify offline zip contains the expected frontend version string.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/desktop/package.json').version")"
ZIP="${1:-$ROOT/dist/installers/ImageSplatStudio-${VERSION}-win-offline.zip}"

if [[ ! -f "$ZIP" ]]; then
  echo "ERROR: Zip not found: $ZIP"
  exit 1
fi

echo ">> Verifying $ZIP for v$VERSION ..."
JS=$(unzip -Z1 "$ZIP" 'resources/frontend/dist/assets/index-*.js' 2>/dev/null | head -1)
if [[ -z "$JS" ]]; then
  echo "ERROR: No frontend bundle in zip"
  exit 1
fi

if ! unzip -p "$ZIP" "$JS" | grep -q "\"$VERSION\""; then
  echo "ERROR: Frontend bundle does not contain version $VERSION"
  unzip -p "$ZIP" "$JS" | grep -oE '"0\.[0-9]+\.[0-9]+"' | sort -u | head -5
  exit 1
fi

if [[ -f "$ROOT/dist/installers/ImageSplatStudio-0.15.8-win-offline.zip" ]]; then
  OLD_HASH=$(sha256sum "$ROOT/dist/installers/ImageSplatStudio-0.15.8-win-offline.zip" | awk '{print $1}')
  NEW_HASH=$(sha256sum "$ZIP" | awk '{print $1}')
  if [[ "$OLD_HASH" == "$NEW_HASH" ]]; then
    echo "ERROR: New zip is identical to 0.15.8 build!"
    exit 1
  fi
fi

echo "OK: $ZIP contains frontend v$VERSION ($JS)"
