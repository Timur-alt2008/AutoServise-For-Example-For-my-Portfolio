@echo off
rem EXAMPLE Auto Service + Web Inspiration Analyzer - one-click start for Windows.
rem Messages are in English on purpose: it keeps this file safe in any Windows code page.
rem Full instructions in Russian: README.md
setlocal
cd /d "%~dp0"
title EXAMPLE Auto Service - dev server

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js is not installed.
  echo Install the LTS version from https://nodejs.org , restart this window and run start.bat again.
  start "" https://nodejs.org/en/download
  pause
  exit /b 1
)

node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit((a>22||(a===22&&b>=18))?0:1)"
if errorlevel 1 (
  echo.
  echo [ERROR] Your Node.js is too old. Version 22.18 or newer is required.
  echo Current version:
  node -v
  echo Install the current LTS from https://nodejs.org and run start.bat again.
  start "" https://nodejs.org/en/download
  pause
  exit /b 1
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Created .env from .env.example - open it in Notepad later to add API keys.
)

if not exist "node_modules" (
  echo.
  echo Installing dependencies. The first run takes 1-3 minutes, please wait...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
echo Starting. The browser opens in a few seconds: http://127.0.0.1:5173
echo Analyzer panel:                               http://127.0.0.1:5173/#/analyzer
echo To stop: press Ctrl+C in this window (answer Y if asked).
echo.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 6; Start-Process 'http://127.0.0.1:5173'"
call npm run dev

echo.
echo Server stopped.
pause
