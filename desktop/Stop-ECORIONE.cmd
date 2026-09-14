@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ecorione.ps1" stop
if errorlevel 1 (
  echo.
  echo ECORIONE gagal dihentikan dengan bersih.
  pause
  exit /b 1
)
