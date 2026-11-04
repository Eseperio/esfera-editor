#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
.venv/bin/python -m PyInstaller --noconfirm --clean --onedir --name esfera-process --distpath build/python --workpath build/pyinstaller --specpath build processing.py
.venv/bin/python scripts/collect-python-licenses.py
