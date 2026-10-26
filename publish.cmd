@echo off
setlocal
cd /d "%~dp0"
echo Publishing cortico-world-coo-control...
echo If npm opens a browser, finish the 2FA there; no 6-digit code is needed.
echo.
call npm run release %*
echo.
pause
