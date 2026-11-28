#!/bin/sh
# Starts the perpetuals desk (long and short, paper only) together with its dashboard.
# It runs next to the spot desk of start.sh, with its own database and dashboard.
# Extra arguments are passed on to `desk run`, for example: ./start-perps.sh --port 8790
cd "$(dirname "$0")" || exit 1
export PYTHONUTF8=1 PYTHONUNBUFFERED=1
# For this process only. Paper even if .env says DESK_MODE=live for the spot desk.
export DESK_MARKET=perps DESK_MODE=paper

# Keep the window open on the way out so its last message can be read: Git Bash on
# Windows closes the window the moment the script ends.
pause_on_exit() {
  status=$?
  echo
  echo "Il desk dei perpetui si è fermato. Premi Invio per chiudere."
  [ -t 0 ] && read -r _
  exit "$status"
}
trap pause_on_exit EXIT

if ! command -v uv >/dev/null 2>&1; then
  echo "Installo uv, che gestisce Python e le dipendenze..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi
if ! command -v uv >/dev/null 2>&1; then
  echo "Installazione di uv non riuscita: controlla la connessione a internet e riprova."
  exit 1
fi

echo "Preparo Python e le librerie. La prima volta servono alcuni minuti: non chiudere la finestra."
if ! uv sync; then
  echo "Riprovo con i certificati del sistema, per gli antivirus che analizzano le connessioni HTTPS..."
  export UV_SYSTEM_CERTS=1
  uv sync || exit 1
fi

echo "Avvio del desk dei perpetui: soldi finti, rialzo e ribasso..."
# --market perps also tells this desk's process apart from the spot desk's.
uv run desk run --market perps --rules-if-no-key --dashboard --open "$@"
