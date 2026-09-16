@echo off
setlocal
if "%ECORIONE_DESKTOP_NO_OPEN%"=="1" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ecorione.ps1" start -NoOpen
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ecorione.ps1" start
)
if errorlevel 1 (
  echo.
  echo ECORIONE gagal dinyalakan. Jalankan Doctor-ECORIONE.cmd untuk diagnosis.
  if not "%ECORIONE_DESKTOP_NONINTERACTIVE%"=="1" pause
  exit /b 1
)
exit /b 0
