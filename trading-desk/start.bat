@echo off
rem Starts the desk in paper trading together with its dashboard.
rem Double-click this file, or run it from a terminal. Extra arguments go to "desk run".
cd /d "%~dp0"
title ARGO DESK
set PYTHONUTF8=1

if not exist pyproject.toml (
  echo Prima estrai lo ZIP: tasto destro sul file, "Estrai tutto", poi avvia start.bat dalla cartella estratta.
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

echo Avvio del desk...
rem The analysts need an Anthropic key in .env; without one the desk decides by rules alone.
uv run desk run --rules-if-no-key --dashboard --open %*

:done
echo.
echo Il desk si e fermato. Premi un tasto per chiudere.
pause >nul
