@echo off
cd /d "%~dp0"
title Zpektra dev
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0dev-host.ps1"
if errorlevel 1 (
    echo.
    pause
)
