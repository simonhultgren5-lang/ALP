@echo off
title Ashen Eclipse
echo Starting Ashen Eclipse...
echo.

cd /d "C:\Users\Andre\Desktop\ALP"

if not exist package.json (
    echo ERROR: package.json not found.
    echo Make sure ALP folder is at C:\Users\Andre\Desktop\ALP
    pause
    exit /b 1
)

if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

echo.
echo Starting server on http://localhost:3000
echo Press Ctrl+C to stop
echo.
call npm run dev

pause
