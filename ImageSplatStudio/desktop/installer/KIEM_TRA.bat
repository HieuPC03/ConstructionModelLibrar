@echo off
chcp 65001 >nul
cd /d "%~dp0"
title ImageSplat Studio - Kiem tra cai dat

echo ========================================
echo  ImageSplat Studio - Kiem tra cai dat
echo ========================================
echo.

set OK=1

if exist "ImageSplat Studio.exe" (
    echo [OK] ImageSplat Studio.exe
) else (
    echo [LOI] Thieu ImageSplat Studio.exe
    set OK=0
)

if exist "resources\python\python.exe" (
    echo [OK] Python dong goi san ^(resources\python\python.exe^)
) else (
    echo [LOI] Thieu Python trong app!
    echo       Ban dang dung ban CU hoac giai nen chua day du.
    echo       Tai: ImageSplatStudio-0.1.3-win-offline.zip (~250 MB)
    set OK=0
)

if exist "resources\backend\app\main.py" (
    echo [OK] Backend
) else (
    echo [LOI] Thieu backend
    set OK=0
)

if exist "resources\frontend\dist\index.html" (
    echo [OK] Frontend
) else (
    echo [LOI] Thieu frontend
    set OK=0
)

echo.
if %OK%==1 (
    echo Cai dat OK — chay "ImageSplat Studio.exe"
) else (
    echo.
    echo === HUONG DAN ===
    echo 1. Xoa thu muc cu
    echo 2. Tai file ZIP OFFLINE tu GitHub Releases
    echo 3. Click phai zip -^> Extract All
    echo 4. Chay lai KIEM_TRA.bat
    echo.
    echo Link: https://github.com/HieuPC03/ConstructionModelLibrar/releases
)
echo.
pause
