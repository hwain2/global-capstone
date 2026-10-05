#!/usr/bin/env bash
set -euo pipefail
dashboard_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python3 -m venv "${dashboard_dir}/.venv"
"${dashboard_dir}/.venv/bin/python" -m pip install --upgrade pip
"${dashboard_dir}/.venv/bin/python" -m pip install -r "${dashboard_dir}/backend/requirements.txt"
cd "${dashboard_dir}"
"${dashboard_dir}/.venv/bin/python" -c 'from backend.service import BaselineStore; from pathlib import Path; BaselineStore(Path.cwd()); print("Baseline JSON and history database ready")'
