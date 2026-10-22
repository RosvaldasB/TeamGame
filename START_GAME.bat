@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 first: https://nodejs.org/
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])!==24)process.exit(1)"
if errorlevel 1 (
  echo This version requires Node.js 24. Please install Node.js 24.
  pause
  exit /b 1
)
echo Open http://localhost:3000 in your browser.
echo Keep this window open while playing. Press Ctrl+C to stop.
start "" "http://localhost:3000"
node server.js
pause
