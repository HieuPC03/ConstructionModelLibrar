@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if not exist "backend\.venv\Scripts\activate.bat" (
  echo Chua cai dat. Chay install.bat truoc.
  pause
  exit /b 1
)

if not exist "backend\.env" (
  echo Thieu backend\.env - chay install.bat hoac copy tu .env.example
  pause
  exit /b 1
)

start "" cmd /c "cd /d "%~dp0backend" && call .venv\Scripts\activate.bat && uvicorn main:app --host 127.0.0.1 --port 8000"

timeout /t 2 /nobreak >nul

cd /d "%~dp0frontend"
if exist "dist\index.html" (
  start "" cmd /c "cd /d "%~dp0frontend" && npx --yes serve dist -l 5173"
) else (
  start "" cmd /c "cd /d "%~dp0frontend" && npm run dev -- --host 127.0.0.1"
)

timeout /t 2 /nobreak >nul
start http://127.0.0.1:5173

echo.
echo Meeting Translator dang chay.
echo   Giao dien: http://127.0.0.1:5173
echo   API:       http://127.0.0.1:8000
echo Dong cua so nay se KHONG tat server - dong cua so "uvicorn" va "serve" de thoat.
echo.
pause
