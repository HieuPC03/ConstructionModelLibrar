import os
import sys
from pathlib import Path


def get_python_executable() -> str:
    """Return the Python interpreter for subprocess pipeline scripts."""
    env_python = os.environ.get("SPLAT_PYTHON")
    if env_python and Path(env_python).exists():
        return env_python
    return sys.executable
