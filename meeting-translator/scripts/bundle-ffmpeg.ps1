# Tai ffmpeg static cho Windows (Live Caption offline)
param([string]$Root = (Split-Path $PSScriptRoot -Parent))

$ErrorActionPreference = "Stop"
$OutDir = Join-Path $Root "runtime\ffmpeg"
if (Test-Path (Join-Path $OutDir "ffmpeg.exe")) {
    Write-Host "FFmpeg da co: $OutDir"
    return
}

Write-Host "Tai ffmpeg essentials (gyan.dev)..."
$ZipUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$Cache = Join-Path $Root "build-cache"
$ZipPath = Join-Path $Cache "ffmpeg-essentials.zip"
New-Item -ItemType Directory -Force -Path $Cache | Out-Null
if (-not (Test-Path $ZipPath)) {
    Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipPath -UseBasicParsing
}
$Temp = Join-Path $Cache "ffmpeg-extract"
if (Test-Path $Temp) { Remove-Item -Recurse -Force $Temp }
Expand-Archive -Path $ZipPath -DestinationPath $Temp -Force
$Bin = Get-ChildItem -Path $Temp -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
if (-not $Bin) { throw "Khong tim thay ffmpeg.exe trong zip" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Copy-Item $Bin.FullName -Destination (Join-Path $OutDir "ffmpeg.exe") -Force
Write-Host "FFmpeg: $(Join-Path $OutDir 'ffmpeg.exe')"
