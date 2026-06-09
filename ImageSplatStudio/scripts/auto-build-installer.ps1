#Requires -Version 5.1
<#
.SYNOPSIS
  Tự động clone repo + build file cài đặt ImageSplat Studio (.exe)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/auto-build-installer.ps1
#>
param(
    [string]$RepoUrl = "https://github.com/HieuPC03/ConstructionModelLibrar.git",
    [string]$Branch = "cursor/desktop-installer-6a40",
    [string]$WorkDir = "$env:TEMP\imagesplat-build",
    [switch]$SkipPythonBundle
)

$ErrorActionPreference = "Stop"

$OutputDir = Join-Path (Split-Path -Parent $PSScriptRoot) "dist\installers"
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " ImageSplat Studio — Auto Clone + Build" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Output: $OutputDir"

if (Test-Path (Join-Path $WorkDir ".git")) {
    Write-Host ">> Updating repo..." -ForegroundColor Yellow
    Push-Location $WorkDir
    git fetch origin $Branch
    git checkout $Branch
    git pull origin $Branch 2>$null
    Pop-Location
} else {
    Write-Host ">> Cloning repo..." -ForegroundColor Yellow
    if (Test-Path $WorkDir) { Remove-Item $WorkDir -Recurse -Force }
    git clone --branch $Branch --depth 1 $RepoUrl $WorkDir
}

$Studio = Join-Path $WorkDir "ImageSplatStudio"
$BuildScript = Join-Path $Studio "build-desktop.ps1"

if (-not (Test-Path $BuildScript)) {
    Write-Host "ERROR: Khong tim thay $BuildScript" -ForegroundColor Red
    Write-Host "Thu branch main hoac kiem tra duong dan ImageSplatStudio/" -ForegroundColor Red
    exit 1
}

Write-Host ">> Building Windows installer..." -ForegroundColor Yellow
if ($SkipPythonBundle) {
    & $BuildScript -SkipPythonBundle
} else {
    & $BuildScript
}

$InstallerSrc = Join-Path $Studio "desktop\dist-installer"
Get-ChildItem $InstallerSrc -Filter "*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName $OutputDir -Force
    Write-Host ">> Copied: $($_.Name)" -ForegroundColor Green
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " XONG! File cai dat:" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Get-ChildItem $OutputDir | ForEach-Object { Write-Host "  $($_.FullName)" -ForegroundColor Cyan }
Write-Host ""
Write-Host "Mo file .exe de cai dat ImageSplat Studio" -ForegroundColor Yellow

# Mo thu muc output
Start-Process explorer.exe $OutputDir
