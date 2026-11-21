@echo off
TITLE FBChess Electron Launcher
COLOR 0A

echo [INFO] Checking project environment...

:: Check if node_modules exists; if not, run npm install
if not exist "node_modules" (
echo [INFO] node_modules not found. Installing dependencies...
call npm install
if errorlevel 1 (
echo [ERROR] Failed to install dependencies. Please check your Node.js installation.
pause
exit /b %errorlevel%
)
)

echo [INFO] Starting FBChess Electron application...
call npx electron .

pause