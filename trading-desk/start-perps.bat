@echo off
rem Starts the perpetuals desk (long and short, paper only) together with its dashboard.
rem It runs next to the spot desk of start.bat, with its own database and dashboard.
rem Double-click this file, or run it from a terminal. Extra arguments go to "desk run".
cd /d "%~dp0"
title ARGO DESK PERPETUI
set PYTHONUTF8=1
rem For this window only. Paper even if .env says DESK_MODE=live for the spot desk.
set DESK_MARKET=perps
set DESK_MODE=paper

if not exist pyproject.toml (
  echo Prima estrai lo ZIP: tasto destro sul file, "Estrai tutto", poi avvia start-perps.bat dalla cartella estratta.
  goto done
)

where uv >nul 2>nul
if errorlevel 1 (
  echo Installo uv, che gestisce Python e le dipendenze...
  powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
  set "PATH=%USERPROFILE%\.local\bin;%PATH%"
)
where uv >nul 2>nul
if errorlevel 1 (
  echo Installazione di uv non riuscita: controlla la connessione a internet e riprova.
  goto done
)

echo Preparo Python e le librerie. La prima volta servono alcuni minuti: non chiudere la finestra.
uv sync
if errorlevel 1 (
  echo Riprovo con i certificati di Windows, per gli antivirus che analizzano le connessioni HTTPS...
  set UV_SYSTEM_CERTS=1
  uv sync
)
if errorlevel 1 goto done

echo Avvio del desk dei perpetui: soldi finti, rialzo e ribasso...
rem --market perps also tells this desk's process apart from the spot desk's.
uv run desk run --market perps --rules-if-no-key --dashboard --open %*

:done
echo.
echo Il desk dei perpetui si e fermato. Premi un tasto per chiudere.
pause >nul
