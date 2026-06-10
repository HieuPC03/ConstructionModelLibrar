# Tai model Whisper (faster-whisper) vao runtime/whisper-models — dong goi trong installer
param(
    [string]$Root = (Split-Path $PSScriptRoot -Parent),
    [string]$Model = "small"
)

$ErrorActionPreference = "Stop"
$Py = Join-Path $Root "runtime\python\python.exe"
if (-not (Test-Path $Py)) {
    throw "Chua co Python runtime. Chay scripts\bundle-python.ps1 truoc."
}

$OutDir = Join-Path $Root "runtime\whisper-models"
$Marker = Join-Path $OutDir ".bundle-$Model.ok"
$RepoDir = Join-Path $OutDir "models--Systran--faster-whisper-$Model"

if ((Test-Path $Marker) -and (Test-Path $RepoDir)) {
    Write-Host "Whisper model '$Model' da co: $OutDir"
    return
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$DlScript = Join-Path $PSScriptRoot "download_whisper_model.py"

Write-Host "[$(Get-Date -Format o)] Tai Whisper model '$Model' (co the ~500MB)..."
$env:HF_HUB_DISABLE_TELEMETRY = "1"
& $Py $DlScript --root $OutDir --model $Model
Write-Host "[$(Get-Date -Format o)] Whisper download script xong."
if ($LASTEXITCODE -ne 0) { throw "Tai Whisper model that bai" }

Set-Content -Path $Marker -Value "ok" -Encoding ASCII
$mb = [math]::Round(
    (Get-ChildItem $OutDir -Recurse -File | Measure-Object Length -Sum).Sum / 1MB,
    1
)
Write-Host "Whisper '$Model' san sang: $OutDir ($mb MB)"
