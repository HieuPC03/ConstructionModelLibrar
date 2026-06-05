#Requires -Version 5.1
<#
.SYNOPSIS
  Build ImageSplat Studio Windows installer (.exe)

.DESCRIPTION
  1. Builds React frontend
  2. Downloads Python embeddable + installs backend deps (optional bundled Python)
  3. Packages Electron app with NSIS installer

  Run on Windows 10/11 with Node.js 20+ installed.

.EXAMPLE
  .\build-desktop.ps1
  .\build-desktop.ps1 -SkipPythonBundle   # use system Python only (smaller installer)
#>
param(
    [switch]$SkipPythonBundle,
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Desktop = Join-Path $Root "desktop"
$Frontend = Join-Path $Root "frontend"
$Backend = Join-Path $Root "backend"
$PythonDir = Join-Path $Desktop "python"
$PythonVersion = "3.11.9"
$PythonZip = "python-$PythonVersion-embed-amd64.zip"
$PythonUrl = "https://www.python.org/ftp/python/$PythonVersion/$PythonZip"

Write-Host "==> ImageSplat Studio Desktop Builder" -ForegroundColor Cyan

# Frontend
Write-Host "==> Building frontend..." -ForegroundColor Yellow
Push-Location $Frontend
npm install
npm run build
Pop-Location

# Bundled Python (Windows embeddable)
if (-not $SkipPythonBundle) {
    Write-Host "==> Bundling Python $PythonVersion..." -ForegroundColor Yellow
    if (Test-Path $PythonDir) { Remove-Item $PythonDir -Recurse -Force }
    New-Item -ItemType Directory -Path $PythonDir | Out-Null

    $zipPath = Join-Path $env:TEMP $PythonZip
    Invoke-WebRequest -Uri $PythonUrl -OutFile $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $PythonDir -Force

    # Enable pip in embeddable Python
    $pthFile = Get-ChildItem "$PythonDir\python*._pth" | Select-Object -First 1
    if ($pthFile) {
        $content = Get-Content $pthFile.FullName
        $content = $content -replace "#import site", "import site"
        $content += "`nLib\site-packages"
        Set-Content $pthFile.FullName $content
    }
    New-Item -ItemType Directory -Path "$PythonDir\Lib\site-packages" -Force | Out-Null

    # Install pip + backend deps
    $getPip = Join-Path $env:TEMP "get-pip.py"
    Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $getPip
    & "$PythonDir\python.exe" $getPip --no-warn-script-location
    & "$PythonDir\python.exe" -m pip install --no-warn-script-location -r "$Backend\requirements.txt"
    Write-Host "    Python bundled at $PythonDir" -ForegroundColor Green
} else {
    Write-Host "==> Skipping Python bundle (installer will use system Python)" -ForegroundColor Yellow
    if (Test-Path $PythonDir) { Remove-Item $PythonDir -Recurse -Force }
    New-Item -ItemType Directory -Path $PythonDir | Out-Null
    Set-Content "$PythonDir\README.txt" "Installer uses system Python. Install Python 3.10+ and pip install -r backend/requirements.txt"
}

# Electron
Write-Host "==> Building Electron installer..." -ForegroundColor Yellow
Push-Location $Desktop
npm install
npm run dist:win
Pop-Location

$OutDir = Join-Path $Desktop "dist-installer"
$DistDir = Join-Path $Root "dist\installers"
New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
Get-ChildItem $OutDir -Filter "*.exe" | Copy-Item -Destination $DistDir -Force
Get-ChildItem $OutDir -Filter "*.zip" | Copy-Item -Destination $DistDir -Force

Write-Host ""
Write-Host "==> DONE!" -ForegroundColor Green
Write-Host "Installer: $OutDir\ImageSplatStudio-Setup-0.1.0.exe" -ForegroundColor Cyan
Write-Host "Copy also: $DistDir\" -ForegroundColor Cyan
Get-ChildItem $OutDir -Filter "*.exe" | ForEach-Object { Write-Host "  $($_.FullName)" }
