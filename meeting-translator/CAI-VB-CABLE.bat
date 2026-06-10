@echo off
chcp 65001 >nul
title Cài VB-Cable — Meeting Translator
cd /d "%~dp0"

set "VBEXE="
if exist "%~dp0VBCABLE_Setup_x64.exe" set "VBEXE=%~dp0VBCABLE_Setup_x64.exe"
if not defined VBEXE if exist "%~dp0resources\runtime\vbcable\VBCABLE_Setup_x64.exe" (
  set "VBEXE=%~dp0resources\runtime\vbcable\VBCABLE_Setup_x64.exe"
)
if not defined VBEXE if exist "%LOCALAPPDATA%\Programs\Meeting Translator\resources\runtime\vbcable\VBCABLE_Setup_x64.exe" (
  set "VBEXE=%LOCALAPPDATA%\Programs\Meeting Translator\resources\runtime\vbcable\VBCABLE_Setup_x64.exe"
)

if not defined VBEXE (
  echo Không tìm thấy VBCABLE_Setup_x64.exe.
  echo.
  echo Tải VB-Cable tại: https://vb-audio.com/Cable/
  echo Giải nén và chạy VBCABLE_Setup_x64.exe bằng «Run as administrator».
  pause
  exit /b 1
)

echo ========================================
echo  Cài VB-Audio Virtual Cable
echo ========================================
echo.
echo 1. Cửa sổ UAC — chọn «Yes» / «Có»
echo 2. Trong VB-Cable Setup — bấm «Install Driver»
echo 3. Windows có thể hỏi cài driver — chọn «Install» / «Cài đặt»
echo 4. SAU KHI CÀI — KHỞI ĐỘNG LẠI máy
echo 5. Win+R → mmsys.cpl → thấy CABLE Input và CABLE Output
echo.
powershell -NoProfile -Command "Start-Process -FilePath '%VBEXE%' -Verb RunAs -Wait"
echo.
echo Nếu đã cài xong, hãy KHỞI ĐỘNG LẠI Windows rồi mở Sound (mmsys.cpl).
pause
