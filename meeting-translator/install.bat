@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo  Meeting Translator - Cai dat
echo ========================================
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo [LOI] Chua co Python. Cai Python 3.10+ tu https://www.python.org/downloads/
  echo       Danh dau "Add Python to PATH" khi cai.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [LOI] Chua co Node.js. Cai Node.js 18+ LTS tu https://nodejs.org/
  pause
  exit /b 1
)

if not exist "backend\.env" (
  copy "backend\.env.example" "backend\.env"
  echo [CANH BAO] Da tao backend\.env - hay mo file va dien OPENAI_API_KEY.
  echo.
)

echo [1/4] Tao moi truong Python...
cd backend
if not exist ".venv" python -m venv .venv
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt
cd ..

echo [2/4] Cai npm frontend...
cd frontend
call npm install
call npm run build
cd ..

echo [3/4] Hoan tat.
echo.
echo Duong dan ung dung: %cd%
echo Chay ung dung: double-click CHAY.bat hoac start.bat
echo Mo trinh duyet: http://127.0.0.1:5173
echo.
pause
