@echo off
cd /d "%~dp0"
start "Zpektra dev" cmd /k npm run dev
timeout /t 4 >nul
start "" "http://127.0.0.1:5173/zpektra/"
