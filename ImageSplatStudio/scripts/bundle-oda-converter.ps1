# Download and extract ODA File Converter for bundling in the desktop installer.
param(
    [string]$Version = "27.1",
    [string]$MsiPath = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Dest = Join-Path $Root "desktop\ODAFileConverter"
$MsiName = "ODAFileConverter_QT6_vc16_amd64dll_$Version.msi"

Write-Host "==> Bundle ODA File Converter (v$Version)"

if (Test-Path (Join-Path $Dest "ODAFileConverter.exe")) {
    Write-Host ">> Already bundled at $Dest"
    exit 0
}

$TempMsi = if ($MsiPath) { $MsiPath } else { Join-Path $env:TEMP $MsiName }

if (-not (Test-Path $TempMsi)) {
    Write-Host ">> Downloading via winget..."
    $dlDir = Join-Path $env:TEMP "oda-dl"
    New-Item -ItemType Directory -Force -Path $dlDir | Out-Null
    winget download -e --id ODA.ODAFileConverter --accept-package-agreements --accept-source-agreements --download-directory $dlDir
    $found = Get-ChildItem -Path $dlDir -Filter "*.msi" -Recurse | Select-Object -First 1
    if (-not $found) {
        throw "winget download failed — place MSI at $TempMsi or set -MsiPath"
    }
    Copy-Item $found.FullName $TempMsi -Force
}

$ExtractRoot = Join-Path $env:TEMP "oda-extract"
if (Test-Path $ExtractRoot) { Remove-Item -Recurse -Force $ExtractRoot }
New-Item -ItemType Directory -Force -Path $ExtractRoot | Out-Null

Write-Host ">> Administrative install (extract)..."
$proc = Start-Process msiexec.exe -ArgumentList @(
    "/a", "`"$TempMsi`"",
    "/qn",
    "TARGETDIR=`"$ExtractRoot`""
) -Wait -PassThru -NoNewWindow
if ($proc.ExitCode -ne 0) {
    throw "msiexec /a failed with exit code $($proc.ExitCode)"
}

$OdaDir = Get-ChildItem -Path $ExtractRoot -Recurse -Filter "ODAFileConverter.exe" | Select-Object -First 1
if (-not $OdaDir) {
    throw "ODAFileConverter.exe not found after extract"
}
$SourceDir = $OdaDir.Directory.FullName

if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Copy-Item -Path (Join-Path $SourceDir "*") -Destination $Dest -Recurse -Force

if (-not (Test-Path (Join-Path $Dest "ODAFileConverter.exe"))) {
    throw "Bundle failed"
}

$size = (Get-ChildItem $Dest -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host ">> ODA bundled: $([math]::Round($size, 1)) MB at $Dest"
