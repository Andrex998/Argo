@echo off
rem Removes the scheduled task created by PROGRAMMA-OI.bat. The saved files stay where they are.
title ARGO - ferma il salvataggio
schtasks /Delete /TN "ARGO salva open interest" /F
echo.
pause
