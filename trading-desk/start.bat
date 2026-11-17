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
uv sync --quiet
if errorlevel 1 goto done

rem Without an Anthropic key the analysts cannot run: the desk decides by rules alone.
set MODE=--rules-only
findstr /R /C:"^ANTHROPIC_API_KEY=." .env >nul 2>nul && set MODE=
uv run desk run %MODE% --dashboard --open %*

:done
echo.
echo Il desk si e fermato. Premi un tasto per chiudere.
pause >nul
