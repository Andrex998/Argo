@echo off
rem Creates the Windows scheduled task that runs SALVA-OI.bat every hour, at minute 7.
rem Double-click once. To stop it, double-click FERMA-OI.bat.
cd /d "%~dp0"
title ARGO - programma il salvataggio
schtasks /Create /TN "ARGO salva open interest" /SC HOURLY /MO 1 /ST 00:07 /TR "\"%~dp0SALVA-OI.bat\" silenzioso" /F
if errorlevel 1 goto failed
echo.
echo Fatto: ogni ora, al minuto 7, il PC salva una riga nella cartella dati.
echo Funziona solo con il PC acceso e la sessione di Windows aperta.
goto done

:failed
echo.
echo Non sono riuscito a creare l'attivita' pianificata. Copia il messaggio qui sopra e mandalo a Claude.

:done
echo.
pause
