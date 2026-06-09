@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist "backend\.venv\Scripts\activate.bat" (
  echo Chua cai dat. Chay install-desktop.bat truoc.
  pause
  exit /b 1
)

if not exist "frontend\dist\index.html" (
  echo Dang build giao dien...
  cd frontend
  call npm run build
  cd ..
)

if not exist "desktop\node_modules" (
  echo Dang cai Electron...
  cd desktop
  call npm install
  cd ..
)

cd desktop
call npm start
