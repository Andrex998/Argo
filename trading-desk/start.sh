#!/bin/sh
# Starts the desk in paper trading together with its dashboard.
# Extra arguments are passed on to `desk run`, for example: ./start.sh --port 8790
set -e
cd "$(dirname "$0")"
export PYTHONUTF8=1 PYTHONUNBUFFERED=1

if ! command -v uv >/dev/null 2>&1; then
  echo "Installo uv, che gestisce Python e le dipendenze..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi
uv sync --quiet

# Without an Anthropic key the analysts cannot run: the desk decides by rules alone.
mode="--rules-only"
if grep -q '^ANTHROPIC_API_KEY=.' .env 2>/dev/null; then mode=""; fi
exec uv run desk run $mode --dashboard --open "$@"
