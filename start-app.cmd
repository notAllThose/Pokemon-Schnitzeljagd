@echo off
cd /d "%~dp0"
if not exist "node_modules\vite\bin\vite.js" (
  echo Installiere die App-Abhaengigkeiten. Das braucht eine Internetverbindung.
  call npm install
  if errorlevel 1 (
    echo.
    echo Installation fehlgeschlagen. Pruefe Node.js und die Internetverbindung.
    pause
    exit /b 1
  )
)
echo Starte die Entdeckertour. Lass dieses Fenster waehrend des Spiels offen.
call npm run dev
pause
