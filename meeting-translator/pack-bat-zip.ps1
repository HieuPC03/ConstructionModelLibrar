# Dong goi tat ca file .bat + huong dan (khong gom .exe)
$Root = $PSScriptRoot
$Out = Join-Path $Root "dist\Meeting-Translator-BAT-scripts.zip"
$Files = @(
  "CAI-BANG-EXE.bat",
  "MO-APP.bat",
  "CAU-HINH-API-KEY.bat",
  "BAT-HUONG-DAN.txt",
  "HUONG_DAN_CAI_DAT.txt",
  "TAO-BAN-CAI-DAT.bat",
  "CHAY-DESKTOP.bat",
  "CHAY.bat",
  "install.bat",
  "install-desktop.bat"
)
New-Item -ItemType Directory -Force -Path (Split-Path $Out) | Out-Null
$Existing = $Files | ForEach-Object { Join-Path $Root $_ } | Where-Object { Test-Path $_ }
Compress-Archive -Path $Existing -DestinationPath $Out -Force
Write-Host "Tao: $Out"
Get-Item $Out | Format-List Name, Length, FullName
