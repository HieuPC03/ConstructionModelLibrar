# Dong goi ung dung DESKTOP Windows (.exe installer)
# Chay tren Windows sau khi co Python + Node.js
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host "=== Meeting Translator - Desktop Installer ===" -ForegroundColor Cyan

Push-Location $Root

if (-not (Test-Path "backend\.venv")) {
    Write-Host "Cai Python backend..."
    Push-Location "$Root\backend"
    python -m venv .venv
    & ".\.venv\Scripts\Activate.ps1"
    pip install -q -r requirements.txt
    Pop-Location
}

if (-not (Test-Path "frontend\node_modules")) {
    Push-Location "$Root\frontend"
    npm install
    Pop-Location
}

Write-Host "Build frontend production..."
Push-Location "$Root\frontend"
npm run build
Pop-Location

Write-Host "Build Windows Setup.exe (Electron)..."
Push-Location "$Root\desktop"
npm run dist:win
Pop-Location

$OutDir = Join-Path $Root "dist\desktop"
Write-Host ""
Write-Host "HOAN TAT - File cai dat desktop:" -ForegroundColor Green
Get-ChildItem $OutDir -Filter "*.exe" -Recurse | ForEach-Object {
    Write-Host "  $($_.FullName)" -ForegroundColor Yellow
    Write-Host "  Kich thuoc: $([math]::Round($_.Length/1MB, 2)) MB"
}

Write-Host ""
Write-Host "Sau khi cai, du lieu luu tai:" -ForegroundColor Cyan
Write-Host "  %APPDATA%\meeting-translator-desktop\"
Write-Host "  (API key: .env | ban ghi: recordings\)"
Pop-Location
