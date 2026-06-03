@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "SETUP="
for %%F in (Meeting-Translator-Setup-*.exe) do set "SETUP=%%F"
if not defined SETUP (
  echo Khong thay file Meeting-Translator-Setup-*.exe trong thu muc nay.
  echo Tai tu GitHub Releases va dat cung folder voi cac file .bat
  pause
  exit /b 1
)
echo Dang chay: %SETUP%
start /wait "" "%SETUP%"
echo.
echo Sau khi cai xong:
echo   1. CAU-HINH-API-KEY.bat  — sua API key
echo   2. MO-APP.bat             — mo ung dung
pause
