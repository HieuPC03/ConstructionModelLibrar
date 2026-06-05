"""Ensure pipeline directory is on sys.path (required for Windows embeddable Python)."""

from __future__ import annotations

import sys
from pathlib import Path

_PIPELINE_DIR = Path(__file__).resolve().parent
_pipeline = str(_PIPELINE_DIR)
if _pipeline not in sys.path:
    sys.path.insert(0, _pipeline)
