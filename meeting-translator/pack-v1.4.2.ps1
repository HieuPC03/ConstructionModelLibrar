# Dong goi phat hanh Meeting Translator v1.4.2 (Windows)
# Chay sau pack-desktop.ps1 hoac goi tu workflow CI
param(
    [string]$Version = "1.4.2"
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Dist = Join-Path $Root "dist"
New-Item -ItemType Directory -Force -Path $Dist | Out-Null

Write-Host "=== Meeting Translator v$Version ===" -ForegroundColor Cyan

# Build installer neu chua co
$Setup = Get-ChildItem (Join-Path $Root "dist\desktop") -Filter "Meeting-Translator-Setup-$Version.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1
if (-not $Setup) {
    $Setup = Get-ChildItem (Join-Path $Root "dist\desktop") -Filter "Meeting-Translator-Setup-*.exe" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
}
if (-not $Setup) {
    Write-Host "Chua co Setup.exe — chay pack-desktop.ps1..." -ForegroundColor Yellow
    & "$Root\pack-desktop.ps1"
    $Setup = Get-ChildItem (Join-Path $Root "dist\desktop") -Filter "Meeting-Translator-Setup-*.exe" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
}
if (-not $Setup) { throw "Khong tim thay Meeting-Translator-Setup-*.exe" }

$TargetExe = Join-Path $Dist "Meeting-Translator-Setup-$Version.exe"
Copy-Item $Setup.FullName -Destination $TargetExe -Force
Write-Host "Setup: $TargetExe ($([math]::Round((Get-Item $TargetExe).Length / 1MB, 2)) MB)" -ForegroundColor Green

# BAT zip
& "$Root\pack-bat-zip.ps1"
$BatZip = Join-Path $Dist "Meeting-Translator-BAT-scripts.zip"
if (Test-Path $BatZip) {
    $BatZipVer = Join-Path $Dist "Meeting-Translator-v$Version-BAT-scripts.zip"
    Copy-Item $BatZip -Destination $BatZipVer -Force
}

# Full package: exe + bat + huong dan
$FullZip = Join-Path $Dist "Meeting-Translator-v$Version-Full-Package.zip"
$Stage = Join-Path $Dist "stage-v$Version"
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force -Path $Stage | Out-Null

Copy-Item $TargetExe -Destination $Stage
@(
    "CAI-BANG-EXE.bat", "MO-APP.bat", "CAU-HINH-API-KEY.bat",
    "BAT-HUONG-DAN.txt", "HUONG_DAN_CAI_DAT.txt", "TAI-BAN-CAI-DAT.txt",
    "TAO-BAN-CAI-DAT.bat", "CHAY-DESKTOP.bat", "CHAY.bat",
    "install.bat", "install-desktop.bat"
) | ForEach-Object {
    $p = Join-Path $Root $_
    if (Test-Path $p) { Copy-Item $p -Destination $Stage }
}

$ReleaseNotes = @"
Meeting Translator v$Version
============================

- Dich van ban: Gemini (che do transcript), tu fallback Google Translate khi het quota
- Nut Lam moi & dat lai: refresh thiet bi + reset app mac dinh
- Dong bo che do phiên trai/phai
- Gemini key AQ.... hoac AIza....

Cai dat: CAI-BANG-EXE.bat hoac Meeting-Translator-Setup-$Version.exe
API key: CAU-HINH-API-KEY.bat
"@
Set-Content -Path (Join-Path $Stage "RELEASE-v$Version.txt") -Value $ReleaseNotes -Encoding UTF8

if (Test-Path $FullZip) { Remove-Item -Force $FullZip }
Compress-Archive -Path "$Stage\*" -DestinationPath $FullZip -Force
Remove-Item -Recurse -Force $Stage

Write-Host ""
Write-Host "Phat hanh v${Version}:" -ForegroundColor Green
Get-ChildItem $Dist -File | Where-Object {
    $_.Name -match "1\.4\.2|BAT-scripts"
} | ForEach-Object {
    Write-Host "  $($_.Name)  $([math]::Round($_.Length / 1MB, 2)) MB"
}
