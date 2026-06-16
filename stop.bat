@echo off
set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
    set FOUND=1
)
if "%FOUND%"=="1" (
    echo Zpektra dev server stopped.
) else (
    echo No dev server running on port 5173.
)
timeout /t 2 >nul
