@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo   TAO BAN CAI DAT - Meeting Translator (Windows)
echo ============================================================
echo.
echo Can: Node.js 18+ (https://nodejs.org)
echo      Ket noi Internet (tai Python embed + Electron)
echo.
echo Ket qua: dist\desktop\Meeting-Translator-Setup-1.0.0.exe
echo.
pause

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pack-desktop.ps1"
if errorlevel 1 (
  echo.
  echo [LOI] Dong goi that bai.
  pause
  exit /b 1
)

echo.
echo Mo thu muc chua file cai dat...
explorer "%~dp0dist\desktop"
pause
