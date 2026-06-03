# Dong goi Meeting Translator thanh file zip cai dat
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Version = "1.4.2"
$OutDir = Join-Path $Root "dist"
$ArchiveName = "Meeting-Translator-v$Version.zip"
$Stage = Join-Path $OutDir "stage-Meeting-Translator"

if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
if (Test-Path (Join-Path $OutDir $ArchiveName)) {
    Remove-Item -Force (Join-Path $OutDir $ArchiveName)
}
New-Item -ItemType Directory -Path $Stage -Force | Out-Null

Write-Host "Build frontend..."
Push-Location (Join-Path $Root "frontend")
if (-not (Test-Path "node_modules")) { npm install }
npm run build
Pop-Location

$Exclude = @(
    "backend\.venv",
    "backend\recordings\*",
    "backend\.env",
    "frontend\node_modules",
    "dist",
    ".git"
)

Write-Host "Copy files..."
Get-ChildItem -Path $Root -Force | Where-Object {
    $_.Name -notin @("dist", ".git")
} | ForEach-Object {
    if ($_.Name -eq "dist") { return }
    Copy-Item -Path $_.FullName -Destination (Join-Path $Stage $_.Name) -Recurse -Force -ErrorAction SilentlyContinue
}

# Clean heavy folders from stage
@(
    (Join-Path $Stage "backend\.venv"),
    (Join-Path $Stage "frontend\node_modules")
) | ForEach-Object {
    if (Test-Path $_) { Remove-Item -Recurse -Force $_ }
}

New-Item -ItemType Directory -Path (Join-Path $Stage "backend\recordings") -Force | Out-Null

Compress-Archive -Path $Stage -DestinationPath (Join-Path $OutDir $ArchiveName) -Force
Remove-Item -Recurse -Force $Stage

$ZipPath = Join-Path $OutDir $ArchiveName
Write-Host ""
Write-Host "Dong goi xong: $ZipPath"
Get-Item $ZipPath | Format-List Name, Length, FullName
