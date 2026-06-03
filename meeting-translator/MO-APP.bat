@echo off
chcp 65001 >nul
title Meeting Translator
set "APP1=%LOCALAPPDATA%\Programs\Meeting Translator\Meeting Translator.exe"
set "APP2=%ProgramFiles%\Meeting Translator\Meeting Translator.exe"
if exist "%APP1%" (
  start "" "%APP1%"
  exit /b 0
)
if exist "%APP2%" (
  start "" "%APP2%"
  exit /b 0
)
echo Khong tim thay Meeting Translator.
echo Hay cai truoc: chay CAI-BANG-EXE.bat (file Setup .exe cung thu muc)
pause
exit /b 1
