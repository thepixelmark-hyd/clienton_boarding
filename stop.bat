@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  ClientOS - stopping local dev environment
echo ============================================
echo.

echo Closing the API and Web dev server windows...
taskkill /FI "WINDOWTITLE eq ClientOS API" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq ClientOS Web" /T /F >nul 2>nul

REM Belt-and-suspenders: if a window was closed by hand but the dev server
REM process is still holding its port, kill whatever is listening on 3000/4000.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":9004" ^| findstr "LISTENING"') do taskkill /PID %%p /F >nul 2>nul
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":9003" ^| findstr "LISTENING"') do taskkill /PID %%p /F >nul 2>nul

set COMPOSE_CMD=docker compose
docker compose version >nul 2>nul
if errorlevel 1 set COMPOSE_CMD=docker-compose

where docker >nul 2>nul
if errorlevel 1 goto done

docker info >nul 2>nul
if errorlevel 1 goto done

echo Stopping the Postgres container...
%COMPOSE_CMD% stop postgres

:done
echo.
echo ============================================
echo  ClientOS stopped. Your database data is kept,
echo  so running start.bat again will pick up right
echo  where you left off.
echo ============================================
pause
