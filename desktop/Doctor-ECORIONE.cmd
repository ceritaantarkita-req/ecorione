@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ecorione.ps1" doctor
set "ECORIONE_EXIT=%ERRORLEVEL%"
echo.
if not "%ECORIONE_DESKTOP_NONINTERACTIVE%"=="1" pause
exit /b %ECORIONE_EXIT%
