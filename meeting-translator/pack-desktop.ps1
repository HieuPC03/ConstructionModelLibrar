# Dong goi ban CAI DAT Windows (.exe) — khong can Python tren may nguoi dung
# Chay: .\pack-desktop.ps1  hoac double-click TAO-BAN-CAI-DAT.bat
param(
    [switch]$SkipPythonBundle,
    [switch]$SkipRuntimeBundle
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Meeting Translator - Dong goi cai dat" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($PSVersionTable.PSVersion.Major -lt 5) {
    throw "Can PowerShell 5+"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Chua co Node.js. Cai tu https://nodejs.org"
}

Push-Location $Root

# 1) Python embed + pip + FFmpeg + Whisper (CI thường chạy riêng bước này)
if (-not $SkipPythonBundle -and -not $SkipRuntimeBundle) {
    Write-Host "[1/6] Dong goi Python runtime..." -ForegroundColor Yellow
    & "$Root\scripts\bundle-python.ps1" -Root $Root
    Write-Host "[1b/6] Bo qua FFmpeg/Whisper (STT qua OpenAI)" -ForegroundColor DarkYellow
    Write-Host "[1c/6] VB-Cable (card am thanh ao)..." -ForegroundColor Yellow
    & "$Root\scripts\bundle-vbcable.ps1" -Root $Root
} elseif ($SkipRuntimeBundle) {
    Write-Host "[1/6] Bo qua bundle runtime (da chay o buoc CI truoc)" -ForegroundColor DarkYellow
} else {
    Write-Host "[1/6] Bo qua bundle Python (dev)" -ForegroundColor DarkYellow
}

# 2) Frontend
Write-Host "[2/6] Build giao dien..." -ForegroundColor Yellow
Push-Location "$Root\frontend"
if (-not (Test-Path "node_modules")) { npm install }
npm run build
if (-not (Test-Path "dist\index.html")) { throw "Frontend build that bai" }
Pop-Location

# 3) Electron deps
Write-Host "[3/6] Cai Electron builder..." -ForegroundColor Yellow
Push-Location "$Root\desktop"
if (-not (Test-Path "node_modules")) { npm install }
Pop-Location

# 4) Build Setup.exe
Write-Host "[4/6] Tao file cai dat NSIS (.exe)..." -ForegroundColor Yellow
Push-Location "$Root\desktop"
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run dist:win
Pop-Location

# 5) Copy huong dan cung goi cai
Write-Host "[5/6] Hoan thien thu muc phat hanh..." -ForegroundColor Yellow
$OutDir = Join-Path $Root "dist\desktop"
$ReleaseDir = Join-Path $Root "dist\release"
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null

$SetupExe = Get-ChildItem $OutDir -Filter "Meeting-Translator-Setup-*.exe" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if ($SetupExe) {
    Copy-Item $SetupExe.FullName -Destination $ReleaseDir -Force
    Copy-Item "$Root\HUONG_DAN_CAI_DAT.txt" -Destination $ReleaseDir -Force
    $readme = @"
MEETING TRANSLATOR - Ban cai dat
================================

1. Chay file: $($SetupExe.Name)
2. Chon thu muc cai dat (Next > Install)
3. Mo Start Menu > Meeting Translator
4. Lan dau: dien OPENAI_API_KEY trong:
   %APPDATA%\meeting-translator-desktop\.env

Khong can cai Python hay Node.js tren may nguoi dung.
STT va dich: can Internet va OPENAI_API_KEY (khong kem Whisper offline).
"@
    Set-Content -Path (Join-Path $ReleaseDir "DOC-DAI.txt") -Value $readme -Encoding UTF8
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " HOAN TAT" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

if ($SetupExe) {
    $mb = [math]::Round($SetupExe.Length / 1MB, 2)
    Write-Host ""
    Write-Host "File cai dat (chinh):" -ForegroundColor White
    Write-Host "  $($SetupExe.FullName)" -ForegroundColor Yellow
    Write-Host "  $mb MB" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Thu muc phat hanh (copy cho nguoi dung):" -ForegroundColor White
    Write-Host "  $ReleaseDir" -ForegroundColor Yellow
    Get-ChildItem $ReleaseDir | ForEach-Object { Write-Host "    - $($_.Name)" }
} else {
    Write-Host "Khong tim thay Setup.exe trong $OutDir" -ForegroundColor Red
    Get-ChildItem $OutDir -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Nguoi dung cai xong: shortcut Desktop + Start Menu" -ForegroundColor Cyan
Write-Host "Du lieu: %APPDATA%\meeting-translator-desktop\" -ForegroundColor Cyan

$verFile = Join-Path $Root "VERSION.txt"
if (Test-Path $verFile) {
    $ver = (Get-Content $verFile -Raw).Trim()
    if ($ver) {
        Write-Host ""
        Write-Host "Dong goi phat hanh v$ver..." -ForegroundColor Yellow
        & "$Root\pack-v1.4.2.ps1" -Version $ver
    }
}

Pop-Location
