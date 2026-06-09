@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ImageSplat Studio

echo ImageSplat Studio - Khoi dong...
echo (Python da duoc dong goi san trong app - khong can cai them)
echo.

if not exist "resources\python\python.exe" (
    echo [LOI] Thieu Python trong app. Tai lai ban cai dat day du tu GitHub Releases.
    pause
    exit /b 1
)

if exist "ImageSplat Studio.exe" (
    start "" "ImageSplat Studio.exe"
) else (
    echo [LOI] Khong tim thay ImageSplat Studio.exe - hay giai nen day du file zip.
    pause
    exit /b 1
)
