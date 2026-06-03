@echo off
chcp 65001 >nul
echo ========================================
echo  Cau hinh Meeting Translator
echo ========================================
echo.
echo OpenAI HET QUOTA? Chon Google Translate (khong can key):
echo   TRANSLATOR_PROVIDER=google
echo.
echo Live Caption + Dich realtime: can OpenAI (ChatGPT / Whisper API):
echo   OPENAI_API_KEY=sk-proj-...  https://platform.openai.com/api-key
echo.
set "ENV_DIR=%APPDATA%\meeting-translator-desktop"
if not exist "%ENV_DIR%" mkdir "%ENV_DIR%"
if not exist "%ENV_DIR%\.env" (
  echo TRANSLATOR_PROVIDER=openai> "%ENV_DIR%\.env"
  echo OPENAI_API_KEY=>> "%ENV_DIR%\.env"
  echo GEMINI_API_KEY=>> "%ENV_DIR%\.env"
  echo GEMINI_MODEL=gemini-2.0-flash>> "%ENV_DIR%\.env"
)
echo File: %ENV_DIR%\.env
echo.
echo GEMINI: key bat dau AQ.... hoac AIza... (https://aistudio.google.com/apikey)
echo OPENAI: sk-proj-... (che do Dich realtime ChatGPT)
echo.
notepad "%ENV_DIR%\.env"
explorer "%ENV_DIR%"
echo Luu file, tat app, chay MO-APP.bat
pause
