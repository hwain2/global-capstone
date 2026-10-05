#!/usr/bin/env bash
set -euo pipefail
dashboard_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${dashboard_dir}"
export AST_MODE="${AST_MODE:-EDITOR_MODE}"
export AST_RUNTIME_DIR="${AST_RUNTIME_DIR:-${dashboard_dir}/.runtime}"
exec "${dashboard_dir}/.venv/bin/uvicorn" backend.app:app --host 127.0.0.1 --port "${AST_PORT:-8765}" --workers 1
