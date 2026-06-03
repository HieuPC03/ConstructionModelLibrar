@echo off
chcp 65001 >nul
echo ========================================
echo  Cau hinh OPENAI_API_KEY (sau khi cai app)
echo ========================================
echo.
echo KHONG dat key vao file cai .exe — chi sua tren may ban:
echo   %%APPDATA%%\meeting-translator-desktop\.env
echo.
set "ENV_DIR=%APPDATA%\meeting-translator-desktop"
if not exist "%ENV_DIR%" mkdir "%ENV_DIR%"
if not exist "%ENV_DIR%\.env" (
  echo TRANSLATOR_PROVIDER=openai> "%ENV_DIR%\.env"
  echo OPENAI_API_KEY=>> "%ENV_DIR%\.env"
  echo OPENAI_STT_MODEL=gpt-4o-mini-transcribe>> "%ENV_DIR%\.env"
  echo OPENAI_TRANSLATE_MODEL=gpt-4o-mini>> "%ENV_DIR%\.env"
)
echo Mo Notepad — dan key cua ban vao dong OPENAI_API_KEY=
echo Luu file, tat app, mo lai Meeting Translator.
echo.
notepad "%ENV_DIR%\.env"
explorer "%ENV_DIR%"
pause
