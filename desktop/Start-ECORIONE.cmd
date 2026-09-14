@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ecorione.ps1" start
if errorlevel 1 (
  echo.
  echo ECORIONE gagal dinyalakan. Jalankan Doctor-ECORIONE.cmd untuk diagnosis.
  pause
  exit /b 1
)
