"""Locate and configure ODA File Converter for ezdxf DWG support."""

from __future__ import annotations

import os
import platform
import shutil
from pathlib import Path

_CONFIGURED = False
_LAST_EXE: Path | None = None


def _oda_candidates() -> list[Path]:
    out: list[Path] = []

    for key in ("ODAFC_EXE", "EZDXF_ODAFC_WIN64_PATH", "ODA_FILE_CONVERTER"):
        val = os.environ.get(key, "").strip().strip('"')
        if val:
            out.append(Path(val))

    app_root = os.environ.get("SPLAT_APP_ROOT", "").strip()
    if app_root:
        root = Path(app_root)
        out.extend(
            [
                root / "ODAFileConverter" / "ODAFileConverter.exe",
                root / "resources" / "ODAFileConverter" / "ODAFileConverter.exe",
            ]
        )

    if platform.system() == "Windows":
        out.extend(
            [
                Path(r"C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe"),
                Path(r"C:\Program Files (x86)\ODA\ODAFileConverter\ODAFileConverter.exe"),
            ]
        )
        # winget default install location may vary — scan Program Files\ODA
        for base in (Path(r"C:\Program Files\ODA"), Path(r"C:\Program Files (x86)\ODA")):
            if base.is_dir():
                for exe in base.rglob("ODAFileConverter.exe"):
                    out.append(exe)

    return out


def find_oda_executable() -> Path | None:
    """Return path to ODAFileConverter.exe if found."""
    global _LAST_EXE
    if _LAST_EXE and _LAST_EXE.is_file():
        return _LAST_EXE

    for candidate in _oda_candidates():
        if candidate.is_file():
            _LAST_EXE = candidate
            return candidate

    if platform.system() in ("Linux", "Darwin"):
        which = shutil.which("ODAFileConverter")
        if which:
            _LAST_EXE = Path(which)
            return _LAST_EXE

    return None


def configure_odafc() -> bool:
    """Point ezdxf odafc addon at a discovered ODA File Converter. Returns True if usable."""
    global _CONFIGURED
    if _CONFIGURED:
        try:
            from ezdxf.addons import odafc

            return odafc.is_installed()
        except ImportError:
            return False

    exe = find_oda_executable()
    if exe is None:
        _CONFIGURED = True
        return False

    try:
        import ezdxf
        from ezdxf.addons import odafc

        if platform.system() == "Windows":
            ezdxf.options.set("odafc-addon", "win_exec_path", str(exe))
        else:
            ezdxf.options.set("odafc-addon", "unix_exec_path", str(exe))
        _CONFIGURED = True
        return odafc.is_installed()
    except ImportError:
        _CONFIGURED = True
        return False


def dwg_import_hint() -> str:
    return (
        "Để import DWG trực tiếp, cài ODA File Converter (miễn phí):\n"
        "  winget install -e --id ODA.ODAFileConverter\n"
        "Hoặc tải tại: https://www.opendesign.com/guestfiles/oda_file_converter\n"
        "Sau đó khởi động lại ImageSplat Studio.\n"
        "Cách khác: AutoCAD → SAVEAS → DXF rồi import file .dxf"
    )
