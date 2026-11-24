@echo off
set PORT=4317
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  taskkill /f /pid %%a >nul 2>&1
  echo [*] stopped pid %%a
)
echo done.
timeout /t 1 /nobreak >nul
