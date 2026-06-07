# Thu thập thông tin TREND-POINT Ver.11 trên PC Windows (local reference cho ImageSplat Studio)
# Usage: powershell -ExecutionPolicy Bypass -File scripts/capture-trend-point-reference.ps1

$ErrorActionPreference = "SilentlyContinue"
$OutDir = Join-Path $PSScriptRoot "..\docs\trend-point-captures"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$Report = Join-Path $OutDir ("report-{0:yyyyMMdd-HHmmss}.txt" -f (Get-Date))
$lines = @()
$lines += "TREND-POINT local reference report"
$lines += "Generated: $(Get-Date -Format o)"
$lines += "Computer: $env:COMPUTERNAME"
$lines += ""

# Search shortcuts
$shortcuts = @(
    "$env:PUBLIC\Desktop\TREND-POINT*.lnk",
    "$env:USERPROFILE\Desktop\TREND-POINT*.lnk",
    "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\**\TREND-POINT*.lnk",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\**\TREND-POINT*.lnk"
)
$found = @()
foreach ($pat in $shortcuts) {
    Get-ChildItem -Path $pat -ErrorAction SilentlyContinue | ForEach-Object { $found += $_ }
}

$lines += "=== Shortcuts ==="
if ($found.Count -eq 0) {
    $lines += "(none found — search manually: Start Menu > TREND-POINT > Open file location)"
} else {
    foreach ($lnk in $found) {
        $shell = New-Object -ComObject WScript.Shell
        $target = $shell.CreateShortcut($lnk.FullName).TargetPath
        $lines += "$($lnk.FullName) -> $target"
        if (Test-Path $target) {
            $ver = (Get-Item $target).VersionInfo
            $lines += "  ProductVersion: $($ver.ProductVersion)"
            $lines += "  FileVersion: $($ver.FileVersion)"
        }
    }
}

# Common install roots
$lines += ""
$lines += "=== Common paths ==="
$roots = @(
    "C:\Program Files\FUKUI COMPUTER",
    "C:\Program Files (x86)\FUKUI COMPUTER",
    "C:\FC",
    "D:\FC"
)
foreach ($r in $roots) {
    if (Test-Path $r) {
        $lines += "EXISTS: $r"
        Get-ChildItem $r -Directory -ErrorAction SilentlyContinue | Select-Object -First 15 | ForEach-Object {
            $lines += "  $($_.Name)"
        }
    }
}

$lines += ""
$lines += "=== Screenshot checklist (save to docs/trend-point-captures/) ==="
$checklist = @(
    "01-ribbon-tabs.png      — Full ribbon with all tabs visible",
    "02-data-list.png        — Left データ一覧 panel",
    "03-viewport-bar.png     — Viewport top bar (透視投影, presets)",
    "04-status-bar.png       — Bottom status (point count + X Y Z)",
    "05-grid-panel.png       — Grid / IDW settings",
    "06-tin-mesh.png         — 三角網 creation result",
    "07-cross-section.png    — 断面 profile",
    "08-trace-surface.png    — トレース + 面抽出 workflow"
)
$lines += $checklist

$lines += ""
$lines += "=== Side-by-side test ==="
$lines += "1. Open same LAS/PLY in TREND-POINT and ImageSplat Studio"
$lines += "2. Compare: tab names, cursor XYZ, TIN mesh, cross-section"
$lines += "3. Write differences in docs/trend-point-captures/notes.md"
$lines += ""
$lines += "Upload PNG + notes.md to repo or send to Cloud Agent."

$lines | Set-Content -Path $Report -Encoding UTF8
Write-Host "Report written: $Report"
Write-Host ""
Get-Content $Report
