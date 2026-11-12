@echo off
setlocal
cd /d "%~dp0"
set PORT=4317
set URL=http://127.0.0.1:%PORT%/

where node >nul 2>nul
if errorlevel 1 (
  echo [x] Node.js not found. Please install Node.js 22+ first.
  pause
  exit /b 1
)

netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul
if errorlevel 1 (
  echo [*] starting DocTree server ...
  wscript //nologo "%~dp0start-hidden.vbs"
  timeout /t 2 /nobreak >nul
) else (
  echo [*] server already running on port %PORT%
)

set EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe
if exist "%EDGE%" (
  start "" "%EDGE%" --app=%URL% --window-size=1500,950 --window-position=60,30
) else (
  set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
  if exist "%CHROME%" (
    start "" "%CHROME%" --app=%URL% --window-size=1500,950 --window-position=60,30
  ) else (
    start "" %URL%
  )
)
endlocal
