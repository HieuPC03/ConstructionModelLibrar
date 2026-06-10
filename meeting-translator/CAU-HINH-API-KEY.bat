@echo off
chcp 65001 >nul
set "ENV_DIR=%APPDATA%\meeting-translator-desktop"
if not exist "%ENV_DIR%" mkdir "%ENV_DIR%"
if not exist "%ENV_DIR%\.env" (
  echo TRANSLATOR_PROVIDER=openai> "%ENV_DIR%\.env"
  echo OPENAI_API_KEY=>> "%ENV_DIR%\.env"
  echo OPENAI_STT_MODEL=gpt-4o-mini-transcribe>> "%ENV_DIR%\.env"
  echo OPENAI_TRANSLATE_MODEL=gpt-4o-mini>> "%ENV_DIR%\.env"
)
notepad "%ENV_DIR%\.env"
echo.
echo OPENAI: https://platform.openai.com — Whisper STT + dich ChatGPT
pause
