# Dong goi ban portable (zip) — nhanh hon NSIS, kem Whisper + Python + FFmpeg
param(
    [switch]$SkipRuntimeBundle
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Push-Location $Root

if (-not $SkipRuntimeBundle) {
    Write-Host "[runtime] Python + FFmpeg + Whisper..." -ForegroundColor Yellow
    & "$Root\scripts\bundle-python.ps1" -Root $Root
    & "$Root\scripts\bundle-ffmpeg.ps1" -Root $Root
    & "$Root\scripts\bundle-whisper.ps1" -Root $Root -Model "small"
}

Write-Host "[frontend] Build..." -ForegroundColor Yellow
Push-Location "$Root\frontend"
if (-not (Test-Path "node_modules")) { npm install }
npm run build
Pop-Location

Write-Host "[electron] dist:dir (khong NSIS)..." -ForegroundColor Yellow
Push-Location "$Root\desktop"
if (-not (Test-Path "node_modules")) { npm install }
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run dist:dir
Pop-Location

$WinUnpacked = Join-Path $Root "dist\desktop\win-unpacked"
if (-not (Test-Path (Join-Path $WinUnpacked "Meeting Translator.exe"))) {
    throw "Khong tim thay win-unpacked\Meeting Translator.exe"
}

$ver = "1.0.0"
if (Test-Path "$Root\VERSION.txt") {
    $ver = (Get-Content "$Root\VERSION.txt" -Raw).Trim()
}

@(
    "MO-APP.bat", "CAU-HINH-API-KEY.bat", "BAT-HUONG-DAN.txt",
    "HUONG_DAN_CAI_DAT.txt", "TAI-BAN-CAI-DAT.txt", "CHAY-PORTABLE.bat"
) | ForEach-Object {
    $src = Join-Path $Root $_
    if (Test-Path $src) { Copy-Item $src -Destination $WinUnpacked -Force }
}

$Dist = Join-Path $Root "dist"
New-Item -ItemType Directory -Force -Path $Dist | Out-Null
$ZipOut = Join-Path $Dist "Meeting-Translator-v$ver-Portable.zip"
if (Test-Path $ZipOut) { Remove-Item -Force $ZipOut }

Write-Host "[zip] Nen portable (~ vai phut)..." -ForegroundColor Yellow
Compress-Archive -Path (Join-Path $WinUnpacked "*") -DestinationPath $ZipOut -CompressionLevel Fastest
$mb = [math]::Round((Get-Item $ZipOut).Length / 1MB, 1)
Write-Host "Portable: $ZipOut ($mb MB)" -ForegroundColor Green

Pop-Location
