#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
VERSION="1.0.0"
OUT_DIR="$ROOT/dist"
ARCHIVE="Meeting-Translator-v${VERSION}.zip"
STAGE="$OUT_DIR/stage-Meeting-Translator"

rm -rf "$STAGE" "$OUT_DIR/$ARCHIVE"
mkdir -p "$STAGE"

echo "Build frontend..."
cd "$ROOT/frontend"
if [ ! -d node_modules ]; then npm install; fi
npm run build

echo "Copy files..."
tar -C "$ROOT" -cf - \
  --exclude='./dist' \
  --exclude='./backend/.venv' \
  --exclude='./backend/.env' \
  --exclude='./backend/recordings' \
  --exclude='./frontend/node_modules' \
  . | tar -C "$STAGE" -xf -

mkdir -p "$STAGE/backend/recordings"
touch "$STAGE/backend/recordings/.gitkeep"

cd "$OUT_DIR"
zip -rq "$ARCHIVE" "$(basename "$STAGE")"
rm -rf "$STAGE"

echo ""
echo "Đóng gói xong:"
echo "  $OUT_DIR/$ARCHIVE"
ls -lh "$OUT_DIR/$ARCHIVE"
