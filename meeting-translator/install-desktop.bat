@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo  Meeting Translator - CAI DAT DESKTOP
echo  (ung dung cua so, KHONG can trinh duyet)
echo ========================================
echo.

call install.bat
if errorlevel 1 exit /b 1

echo.
echo [Desktop] Cai Electron...
cd desktop
call npm install
cd ..

echo.
echo ========================================
echo  Xong! Chay ung dung desktop:
echo    CHAY-DESKTOP.bat
echo.
echo  Tao file cai .exe (tren Windows):
echo    pack-desktop.ps1
echo ========================================
pause
