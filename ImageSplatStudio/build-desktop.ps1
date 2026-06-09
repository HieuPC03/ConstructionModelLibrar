#Requires -Version 5.1
<#
.SYNOPSIS
  Build ImageSplat Studio Windows app WITH bundled Python (offline, no external install).
#>
param(
    [switch]$SkipPythonBundle  # dev only — releases MUST bundle Python
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Desktop = Join-Path $Root "desktop"
$Frontend = Join-Path $Root "frontend"
$Backend = Join-Path $Root "backend"
$PythonDir = Join-Path $Desktop "python"
$PythonVersion = "3.11.9"
$PythonZip = "python-$PythonVersion-embed-amd64.zip"
$PythonUrl = "https://www.python.org/ftp/python/$PythonVersion/$PythonZip"

Write-Host "==> ImageSplat Studio Desktop Builder" -ForegroundColor Cyan
Write-Host "    Root: $Root" -ForegroundColor Gray

Write-Host "==> Building frontend..." -ForegroundColor Yellow
Push-Location $Frontend
npm install
npm run build
Pop-Location

Write-Host "==> Generating app icons..." -ForegroundColor Yellow
python "$Root\scripts\generate-app-icon.py"

if ($SkipPythonBundle) {
    Write-Error "SkipPythonBundle is disabled for release builds. App requires bundled Python."
}

Write-Host "==> Bundling Python $PythonVersion + dependencies..." -ForegroundColor Yellow
if (Test-Path $PythonDir) { Remove-Item $PythonDir -Recurse -Force }
New-Item -ItemType Directory -Path $PythonDir | Out-Null

$zipPath = Join-Path $env:TEMP $PythonZip
Write-Host "    Download Python embeddable..."
Invoke-WebRequest -Uri $PythonUrl -OutFile $zipPath -UseBasicParsing
Expand-Archive -Path $zipPath -DestinationPath $PythonDir -Force

$pthFile = Get-ChildItem "$PythonDir\python*._pth" | Select-Object -First 1
if (-not $pthFile) { throw "Cannot find python*._pth in embeddable Python" }

$pthContent = Get-Content $pthFile.FullName -Raw
$pthContent = $pthContent -replace "#import site", "import site"
$pthContent = $pthContent -replace "# import site", "import site"
if ($pthContent -notmatch "Lib\\site-packages") {
    $pthContent += "`nLib\site-packages`n"
}
Set-Content $pthFile.FullName $pthContent -NoNewline

$sitePackages = Join-Path $PythonDir "Lib\site-packages"
New-Item -ItemType Directory -Path $sitePackages -Force | Out-Null

Write-Host "    Installing pip..."
$getPip = Join-Path $env:TEMP "get-pip.py"
Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $getPip -UseBasicParsing
& "$PythonDir\python.exe" $getPip --no-warn-script-location

Write-Host "    Installing backend packages (open3d, fastapi, uvicorn...)..."
& "$PythonDir\python.exe" -m pip install --no-warn-script-location `
    -r "$Backend\requirements.txt" `
    --only-binary=:all: `
    --prefer-binary

Write-Host "    Verifying bundled Python..."
& "$PythonDir\python.exe" -c "import uvicorn, open3d, fastapi, laspy; print('Python bundle OK')"
if ($LASTEXITCODE -ne 0) { throw "Bundled Python verification failed" }

$PipelineDir = Join-Path $Root "pipeline"
& "$PythonDir\python.exe" -c "import sys; sys.path.insert(0, r'$PipelineDir'); from write_splat import pack_rotation; print('Pipeline imports OK')"
if ($LASTEXITCODE -ne 0) { throw "Pipeline import verification failed" }

$pySize = (Get-ChildItem $PythonDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "    Python bundle size: $([math]::Round($pySize, 1)) MB" -ForegroundColor Green

Write-Host "==> Building Electron package..." -ForegroundColor Yellow
Push-Location $Desktop
npm install
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
# Native Windows build embeds icon into .exe via rcedit
npm run dist:win -- --config.win.signAndEditExecutable=true
Pop-Location

$OutDir = Join-Path $Desktop "dist-installer"
$DistDir = Join-Path $Root "dist\installers"
New-Item -ItemType Directory -Path $DistDir -Force | Out-Null

$winUnpacked = Join-Path $OutDir "win-unpacked"
$bundledInApp = Join-Path $winUnpacked "resources\python\python.exe"
if (-not (Test-Path $bundledInApp)) {
    throw "Python not packaged in app! Missing: $bundledInApp"
}
Write-Host "    Verified python.exe inside app package" -ForegroundColor Green

$packagedPipeline = Join-Path $winUnpacked "resources\pipeline"
foreach ($required in @("write_splat.py", "pointcloud_io.py", "pointcloud_to_gaussian.py")) {
    if (-not (Test-Path (Join-Path $packagedPipeline $required))) {
        throw "Missing pipeline file in app: $required"
    }
}
Write-Host "    Verified pipeline files in app package" -ForegroundColor Green

$offlineZip = Join-Path $DistDir "ImageSplatStudio-$((Get-Content (Join-Path $Desktop 'package.json') | ConvertFrom-Json).version)-win-offline.zip"
if (Test-Path $offlineZip) { Remove-Item $offlineZip -Force }
Compress-Archive -Path (Join-Path $winUnpacked "*") -DestinationPath $offlineZip -Force
Write-Host "    Created offline zip: $offlineZip" -ForegroundColor Green

Get-ChildItem $OutDir -Include "*.exe","*.zip" -Recurse -File | Copy-Item -Destination $DistDir -Force

Write-Host ""
Write-Host "==> DONE!" -ForegroundColor Green
Get-ChildItem $DistDir | ForEach-Object { Write-Host "  $($_.FullName) ($([math]::Round($_.Length/1MB,1)) MB)" -ForegroundColor Cyan }
