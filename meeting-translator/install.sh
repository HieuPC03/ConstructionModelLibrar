#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "========================================"
echo " Meeting Translator - Cài đặt"
echo "========================================"

command -v python3 >/dev/null || { echo "Cần Python 3.10+"; exit 1; }
command -v npm >/dev/null || { echo "Cần Node.js 18+"; exit 1; }

if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "Đã tạo backend/.env — hãy điền OPENAI_API_KEY."
fi

python3 -m venv backend/.venv
# shellcheck disable=SC1091
source backend/.venv/bin/activate
pip install -q -r backend/requirements.txt

cd frontend
npm install
npm run build
cd "$ROOT"

echo ""
echo "Xong. Đường dẫn: $ROOT"
echo "Chạy: ./start.sh hoặc ./CHAY.sh"
