# Tai VB-Audio Virtual Cable (Windows x64) — kem trong installer
param(
    [string]$Root = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = "Stop"
$OutDir = Join-Path $Root "runtime\vbcable"
$SetupExe = Join-Path $OutDir "VBCABLE_Setup_x64.exe"
$Marker = Join-Path $OutDir ".bundle-ok"

if ((Test-Path $SetupExe) -and (Test-Path $Marker)) {
    Write-Host "VB-Cable da san sang: $SetupExe"
    return
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$CacheDir = Join-Path $Root "build-cache"
New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null

$ZipName = "VBCABLE_Driver_Pack45.zip"
$ZipUrl = "https://download.vb-audio.com/Download_CABLE/$ZipName"
$ZipPath = Join-Path $CacheDir $ZipName

if (-not (Test-Path $ZipPath)) {
    Write-Host "Tai VB-Cable tu vb-audio.com..."
    Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipPath -UseBasicParsing
}

$ExtractDir = Join-Path $CacheDir "vbcable-extract"
if (Test-Path $ExtractDir) { Remove-Item -Recurse -Force $ExtractDir }
Expand-Archive -Path $ZipPath -DestinationPath $ExtractDir -Force

$found = Get-ChildItem -Path $ExtractDir -Recurse -Filter "VBCABLE_Setup_x64.exe" |
    Select-Object -First 1
if (-not $found) {
    throw "Khong tim thay VBCABLE_Setup_x64.exe trong goi VB-Cable"
}

Copy-Item $found.FullName -Destination $SetupExe -Force
Set-Content -Path $Marker -Value "ok"
Write-Host "VB-Cable: $SetupExe ($([math]::Round((Get-Item $SetupExe).Length / 1MB, 2)) MB)"
