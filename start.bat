@echo off

REM Double-clicking a .bat file runs it via "cmd /c", which closes the
REM window the instant the script ends - including a crash, which means
REM any error (even one this script doesn't explicitly catch) flashes by
REM too fast to read. Relaunch once inside "cmd /k" instead, which keeps
REM the window open at a prompt no matter how the script below finishes.
if not defined CLIENTOS_RELAUNCHED (
  set CLIENTOS_RELAUNCHED=1
  cmd /k call "%~f0"
  exit /b
)

setlocal
cd /d "%~dp0"

echo ============================================
echo  ClientOS - starting local dev environment
echo ============================================
echo.

echo Checking for Node.js...
REM ---- 1. Node.js -----------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found on PATH.
  echo         Install Node.js 20+ from https://nodejs.org and re-run this script.
  pause
  exit /b 1
)
echo   found.
echo.

REM ---- 2. pnpm -----------------------------------------------------------
REM Deliberately NOT using whatever "pnpm" command (if any) is already on
REM this machine's PATH: a corepack-managed pnpm shim can be broken (points
REM at a path missing .cmd/.exe) or, worse, point at a mapped network drive
REM that isn't currently connected, which can hang for a long time instead
REM of failing fast. Running pnpm through npx instead only depends on the
REM Node.js install just confirmed above, nothing else on this machine.
echo Setting up pnpm via npx - this may need a moment to download it on
echo first run...
set PNPM=call npx --yes pnpm@12.8.1
%PNPM% --version
if errorlevel 1 (
  echo [ERROR] Could not run pnpm via npx. Check your internet connection
  echo         and that npm/npx works at all ^(try "npx --version"^).
  pause
  exit /b 1
)
echo.

echo Checking for Docker...
REM ---- 3. Docker Desktop ------------------------------------------------
where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker was not found on PATH.
  echo         Install Docker Desktop from https://www.docker.com/products/docker-desktop
  echo         then re-run this script.
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker is installed but doesn't seem to be running.
  echo         Start Docker Desktop, wait for it to finish starting, then re-run this script.
  pause
  exit /b 1
)
echo   found and running.
echo.

set COMPOSE_CMD=docker compose
docker compose version >nul 2>nul
if errorlevel 1 set COMPOSE_CMD=docker-compose

REM ---- 4. Start Postgres (only the database - the apps run via pnpm below,
REM         so file changes hot-reload instead of waiting on a Docker rebuild) ----
echo Starting the Postgres container...
%COMPOSE_CMD% up -d postgres
if errorlevel 1 (
  echo.
  echo [ERROR] Failed to start the Postgres container - see the Docker error above.
  echo.
  echo If it says a port is "already allocated" or "already in use", something
  echo else on your machine is already listening on that port - most often a
  echo PostgreSQL service installed directly on Windows and set to start
  echo automatically. Find what's using it with:
  echo     netstat -ano ^| findstr :5433
  echo then either stop that process/service, or open docker-compose.yml and
  echo change the postgres "5433:5432" port mapping to a free port on your
  echo machine ^(and update DATABASE_URL in packages\database\.env, apps\api\.env
  echo and .env.example to match^).
  pause
  exit /b 1
)

echo Waiting for Postgres to become healthy...
for /f "tokens=*" %%i in ('%COMPOSE_CMD% ps -q postgres') do set PG_CID=%%i
set WAITED=0
:waitloop
for /f "tokens=*" %%h in ('docker inspect -f "{{.State.Health.Status}}" %PG_CID% 2^>nul') do set HEALTH=%%h
if "%HEALTH%"=="healthy" goto healthy
set /a WAITED+=1
if %WAITED% GEQ 30 (
  echo [ERROR] Postgres did not become healthy within 60 seconds.
  echo         Run "docker compose logs postgres" to see what's wrong.
  pause
  exit /b 1
)
timeout /t 2 /nobreak >nul
goto waitloop
:healthy
echo Postgres is ready.
echo.

REM ---- 5. Create local env files on first run --------------------------
REM Each app/package only reads the keys it needs, so one shared template
REM is safe to copy into all three locations.
if not exist "apps\api\.env" (
  echo Creating apps\api\.env from .env.example...
  copy /y ".env.example" "apps\api\.env" >nul
)
if not exist "apps\web\.env.local" (
  echo Creating apps\web\.env.local from .env.example...
  copy /y ".env.example" "apps\web\.env.local" >nul
)
if not exist "packages\database\.env" (
  echo Creating packages\database\.env from .env.example...
  copy /y ".env.example" "packages\database\.env" >nul
)

REM ---- 6. Install dependencies (first run only) -------------------------
if not exist "node_modules" (
  echo Installing dependencies - this can take a few minutes on first run...
  %PNPM% install
  if errorlevel 1 (
    echo [ERROR] pnpm install failed. See the error above.
    pause
    exit /b 1
  )
) else (
  echo Dependencies already installed - skipping "pnpm install".
  echo ^(Delete the node_modules folder to force a clean reinstall.^)
)
echo.

REM ---- 7. Prisma client + migrations -------------------------------------
echo Generating the Prisma client and applying database migrations...
%PNPM% db:generate
%PNPM% db:migrate:deploy
if errorlevel 1 (
  echo [ERROR] Database migration failed.
  echo         Check DATABASE_URL in packages\database\.env and that Postgres is reachable.
  pause
  exit /b 1
)
echo.

REM ---- 8. Seed demo data (safe to re-run) --------------------------------
echo Seeding demo data...
%PNPM% db:seed
echo.

REM ---- 9. Launch the API and Web dev servers in their own windows --------
echo Starting the API and Web dev servers...
start "ClientOS API" cmd /k "cd /d "%~dp0" && %PNPM% dev:api"
start "ClientOS Web" cmd /k "cd /d "%~dp0" && %PNPM% dev:web"

echo.
echo ============================================
echo  ClientOS is starting up.
echo.
echo    Web:   http://localhost:9003
echo    API:   http://localhost:9004
echo.
echo    Demo login:  alex@meridian.agency / DemoPass123
echo.
echo  Two new windows just opened for the API and Web servers -
echo  leave them running. Give it 10-20 seconds, then open the Web
echo  link above in your browser.
echo.
echo  Run stop.bat to shut everything down.
echo ============================================
pause
