#!/usr/bin/env bash
# Start a local Jupyter Server for AlphaStream Notebook integration.
# Usage: ./start-notebook-server.sh [root_dir] [port]

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${1:-$HOME/alphastream-notebooks}"
PORT="${2:-8888}"

mkdir -p "$ROOT_DIR"

if [[ ! -x "$SCRIPT_DIR/.venv/bin/python" ]]; then
  echo "Creating virtual environment..."
  python3 -m venv "$SCRIPT_DIR/.venv"
  "$SCRIPT_DIR/.venv/bin/pip" install -r "$SCRIPT_DIR/requirements.txt"
fi

TOKEN="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"

echo ""
echo "=== AlphaStream Jupyter Server ==="
echo "URL:   http://localhost:${PORT}"
echo "Token: ${TOKEN}"
echo "Root:  ${ROOT_DIR}"
echo ""
echo "Paste URL + token into AlphaStream Notebook -> kernel connection settings."
echo ""

export JUPYTER_CONFIG_DIR="$SCRIPT_DIR"
exec "$SCRIPT_DIR/.venv/bin/python" -m jupyter server \
  --ServerApp.root_dir="$ROOT_DIR" \
  --ServerApp.port="$PORT" \
  --ServerApp.allow_origin="http://localhost:8080" \
  --ServerApp.allow_origin_pat='http://localhost:(8080|5173)' \
  --ServerApp.disable_check_xsrf=True \
  --IdentityProvider.token="$TOKEN" \
  --no-browser
