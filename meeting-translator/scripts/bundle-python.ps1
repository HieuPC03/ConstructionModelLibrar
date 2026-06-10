# Tai Python embeddable + cai thu vien backend (Windows x64)
param(
    [string]$Root = (Split-Path $PSScriptRoot -Parent),
    [string]$PythonVersion = "3.12.8"
)

$ErrorActionPreference = "Stop"
$RuntimeDir = Join-Path $Root "runtime\python"
$ReqFile = Join-Path $Root "backend\requirements.txt"

if (Test-Path (Join-Path $RuntimeDir "python.exe")) {
    $marker = Join-Path $RuntimeDir ".bundle-ok"
    if (Test-Path $marker) {
        Write-Host "Python runtime da san sang: $RuntimeDir"
        return
    }
}

Write-Host "Tai Python $PythonVersion embeddable..."
$ZipName = "python-$PythonVersion-embed-amd64.zip"
$ZipUrl = "https://www.python.org/ftp/python/$PythonVersion/$ZipName"
$CacheDir = Join-Path $Root "build-cache"
$ZipPath = Join-Path $CacheDir $ZipName

New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
if (-not (Test-Path $ZipPath)) {
    Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipPath -UseBasicParsing
}

if (Test-Path $RuntimeDir) { Remove-Item -Recurse -Force $RuntimeDir }
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

Expand-Archive -Path $ZipPath -DestinationPath $RuntimeDir -Force

# Bat site-packages cho pip
$PthFile = Get-ChildItem $RuntimeDir -Filter "python*._pth" | Select-Object -First 1
if ($PthFile) {
    $pth = @(
        "python312.zip",
        ".",
        "Lib\site-packages",
        "import site"
    )
    if ($PythonVersion -like "3.11*") {
        $pth[0] = "python311.zip"
    }
    Set-Content -Path $PthFile.FullName -Value ($pth -join "`r`n") -Encoding ASCII
}

New-Item -ItemType Directory -Force -Path (Join-Path $RuntimeDir "Lib\site-packages") | Out-Null

$PythonExe = Join-Path $RuntimeDir "python.exe"
$GetPip = Join-Path $CacheDir "get-pip.py"
if (-not (Test-Path $GetPip)) {
    Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $GetPip -UseBasicParsing
}

Write-Host "Cai pip..."
& $PythonExe $GetPip --no-warn-script-location

Write-Host "Cai thu vien backend..."
& $PythonExe -m pip install -r $ReqFile --no-warn-script-location

Set-Content -Path (Join-Path $RuntimeDir ".bundle-ok") -Value "ok"
Write-Host "Xong Python runtime (~$( [math]::Round((Get-ChildItem $RuntimeDir -Recurse | Measure-Object Length -Sum).Sum/1MB, 1) ) MB)"
