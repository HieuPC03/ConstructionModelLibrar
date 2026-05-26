# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

This is a **Windows-only .NET Framework 4.8 AutoCAD/Civil 3D plugin** called ConstructionModelLibrary. It provides a WPF palette UI inside AutoCAD for browsing and inserting 3D construction equipment models. The source code was originally distributed as a zip archive; it has been extracted into the repository root.

### Key constraints for Cloud Agents (Linux VM)

- **Cannot build the main plugin project** on Linux. The `ConstructionModelLibrary` project targets `.NET Framework 4.8`, uses `WPF` (`UseWPF=true`), and references AutoCAD SDK DLLs (`accoremgd.dll`, `acdbmgd.dll`, `acmgd.dll`, `AdWindows.dll`) that only exist on Windows machines with AutoCAD installed.
- **Cannot run or test end-to-end.** The plugin runs *inside* the AutoCAD host process. There is no standalone executable to launch.
- **The Installer project builds successfully** on Linux: `dotnet build ConstructionModelLibrary.Installer/ConstructionModelLibrary.Installer.csproj`. It has no AutoCAD SDK dependencies.
- **NuGet restore works**: `dotnet restore ConstructionModelLibrary.sln` succeeds. The only NuGet dependency is `System.Text.Json 8.0.5`.

### What you CAN do on the Linux VM

- Edit C# source files, XAML, JSON data files, PowerShell build scripts.
- Run `dotnet restore` to validate NuGet package resolution.
- Build the Installer project: `dotnet build ConstructionModelLibrary.Installer/ConstructionModelLibrary.Installer.csproj`.
- Inspect and modify `catalog.json`, `settings.json`, and asset files under `ConstructionModelLibrary/Assets/`.

### Repository structure

| Path | Description |
|------|-------------|
| `ConstructionModelLibrary/` | Main plugin C# project (WPF + AutoCAD SDK) |
| `ConstructionModelLibrary.Installer/` | Windows Forms installer EXE project |
| `ConstructionModelLibrary.sln` | Visual Studio solution file |
| `build.ps1` | PowerShell build script (builds R24 + R25 targets) |
| `pack-release.ps1` | PowerShell release packaging script |
| `dist/` | Pre-built distribution artifacts |
| `ConstructionModelLibrary/Assets/` | Catalog JSON, settings, model/thumbnail placeholders |

### Build commands (Windows only)

```powershell
# Full build (requires AutoCAD 2023+ installed):
.\build.ps1 -Configuration Release

# With explicit AutoCAD path:
.\build.ps1 -AcadInstallDir "C:\Program Files\Autodesk\AutoCAD 2023"
```

### No automated tests

There is no test project in this solution. No unit tests, integration tests, or CI/CD configuration exists.

### AutoCAD commands (when plugin is loaded)

| Command | Description |
|---------|-------------|
| `CMLIB` | Open the construction model library palette |
| `CMLINSERT` | Insert a model by name |
| `CMLSCALE` | Set project scale factor |
