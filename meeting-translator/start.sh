#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$ROOT/backend/.env" ]; then
  echo "Tạo backend/.env từ .env.example và điền API key."
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
fi

python3 -m venv "$ROOT/backend/.venv" 2>/dev/null || true
# shellcheck disable=SC1091
source "$ROOT/backend/.venv/bin/activate"
pip install -q -r "$ROOT/backend/requirements.txt"

cd "$ROOT/backend"
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACK_PID=$!

cd "$ROOT/frontend"
if [ ! -d node_modules ]; then
  npm install
fi
npm run dev -- --host 0.0.0.0 &
FRONT_PID=$!

trap 'kill $BACK_PID $FRONT_PID 2>/dev/null' EXIT
echo "Backend: http://127.0.0.1:8000"
echo "Frontend: http://127.0.0.1:5173"
wait
