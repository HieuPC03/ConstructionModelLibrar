@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ImageSplat Studio - Cai dat va chay

echo ==============================================
echo   ImageSplat Studio - Cai dat
echo ==============================================
echo.

REM Tim Python
set "PY="
if exist "resources\python\python.exe" (
    set "PY=resources\python\python.exe"
    echo [OK] Dung Python bundled
) else (
    where py >nul 2>&1 && set "PY=py -3"
    if not defined PY where python >nul 2>&1 && set "PY=python"
)

if not defined PY (
    echo [LOI] Khong tim thay Python!
    echo.
    echo Cai Python 3.10+ tu: https://www.python.org/downloads/
    echo QUAN TRONG: Tick "Add python.exe to PATH" khi cai dat!
    echo.
    pause
    exit /b 1
)

echo [..] Kiem tra Python...
%PY% --version
if errorlevel 1 (
    echo [LOI] Python khong chay duoc
    pause
    exit /b 1
)

echo.
echo [..] Cai thu vien (lan dau mat 2-5 phut)...
%PY% -m pip install --upgrade pip -q 2>nul
%PY% -m pip install -r "resources\backend\requirements.txt" --no-warn-script-location
if errorlevel 1 (
    echo [LOI] Cai thu vien that bai. Thu chay voi quyen Admin.
    pause
    exit /b 1
)

echo.
echo [OK] Cai dat xong! Dang mo app...
echo.

if exist "ImageSplat Studio.exe" (
    start "" "ImageSplat Studio.exe"
) else (
    echo [LOI] Khong tim thay "ImageSplat Studio.exe"
    echo Hay giai nen DAY DU file zip truoc khi chay.
    pause
    exit /b 1
)

timeout /t 3 >nul
