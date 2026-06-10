@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist "Meeting Translator.exe" (
  start "" "Meeting Translator.exe"
  exit /b 0
)
if exist "win-unpacked\Meeting Translator.exe" (
  start "" "win-unpacked\Meeting Translator.exe"
  exit /b 0
)
echo Giai nen file Meeting-Translator-v*-Portable.zip vao thu muc nay, roi chay lai file .bat nay.
pause
