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
    echo       Tai: ImageSplatStudio-*-win-offline.zip (~300 MB)
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
echo === Phien ban ===
if exist "VERSION.txt" (
    type VERSION.txt
    findstr /C:"0.17.0" VERSION.txt >nul 2>&1
    if errorlevel 1 (
        echo [CANH BAO] Khong phai ban 0.17.0 — tai zip moi tu GitHub Releases.
        set OK=0
    ) else (
        echo [OK] Dung phien ban 0.17.0
    )
) else (
    echo [CANH BAO] Khong co VERSION.txt — co the la ban giai nen CU hoac giai nen khong day du.
    echo            Neu app hien v0.15.x/0.16.x: XOA het thu muc, giai nen LAI zip 0.17.0.
    set OK=0
)

echo.
if %OK%==1 (
    echo Cai dat OK — chay "ImageSplat Studio.exe"
    echo Trong app, gooc tren trai phai hien: v0.17.0
) else (
    echo.
    echo === HUONG DAN SUA LOI PHIEN BAN ===
    echo 1. Dong ImageSplat Studio hoan toan
    echo 2. XOA het thu muc cu ^(khong giai nen de len file cu^)
    echo 3. Tai ZIP tu GitHub Releases:
    echo    ImageSplatStudio-0.17.0-win-offline.zip
    echo 4. Click phai zip -^> Extract All... vao thu muc MOI
    echo 5. Chay lai KIEM_TRA.bat — phai thay VERSION.txt va v0.17.0
    echo.
    echo Link: https://github.com/HieuPC03/ConstructionModelLibrar/releases/tag/imagesplat-v0.17.0
)
echo.
pause
