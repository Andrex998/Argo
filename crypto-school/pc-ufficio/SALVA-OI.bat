@echo off
rem Saves one line of open interest and prices for the 36 coins of the school.
rem Double-click to try it. The scheduled task runs it with the word "silenzioso".
cd /d "%~dp0"
title ARGO - salva open interest
set PYTHONUTF8=1
set "PATH=%USERPROFILE%\.local\bin;%PATH%"

where uv >nul 2>nul
if not errorlevel 1 goto with_uv
where python >nul 2>nul
if not errorlevel 1 goto with_python
echo Non trovo Python. Avvia una volta start-perps.bat del desk, che installa uv, poi riprova.
goto done

:with_uv
uv run --no-project --python 3.12 python salva_oi.py
goto done

:with_python
python salva_oi.py

:done
if /i "%~1"=="silenzioso" exit /b
echo.
pause
