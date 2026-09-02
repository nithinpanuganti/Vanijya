@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"

echo ===============================================================================
echo   🌾 VANIJYA (वाणिज्य) - National Agricultural Price Discovery Portal
echo   Smart India Hackathon 2026 | Problem Statement: SIH 26132
echo ===============================================================================
echo.

REM -----------------------------------------------------------------------------
REM 1. Verify Node.js & npm
REM -----------------------------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 goto NO_NODE

where npm >nul 2>&1
if errorlevel 1 goto NO_NPM

echo [1/6] Node.js and npm detected.

REM -----------------------------------------------------------------------------
REM 2. Environment Configuration Check & Auto-Creation
REM -----------------------------------------------------------------------------
if not exist "apps\backend\.env" (
    echo [2/6] apps\backend\.env not found. Creating from .env.example template...
    if exist "apps\backend\.env.example" (
        copy /y "apps\backend\.env.example" "apps\backend\.env" >nul
    )
    (
        echo # Vanijya Backend Environment Configuration
        echo MONGODB_URI=mongodb://127.0.0.1:27017/vanijya
        echo JWT_SECRET=vanijya_super_secret_jwt_key_sih2026_national_trade
        echo JWT_EXPIRES_IN=7d
        echo PORT=4000
        echo NODE_ENV=development
    ) > "apps\backend\.env"
    echo [2/6] Created apps\backend\.env with default configuration.
) else (
    echo [2/6] apps\backend\.env verified.
)

REM -----------------------------------------------------------------------------
REM 3. MongoDB Connectivity Check & Auto-Start Attempt
REM -----------------------------------------------------------------------------
echo [3/6] Checking MongoDB database connection...

REM Try starting MongoDB Windows service if installed
sc query MongoDB >nul 2>&1
if %errorlevel% equ 0 (
    net start MongoDB >nul 2>&1
)

REM Test port 27017 using PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command "$tcp = New-Object System.Net.Sockets.TcpClient; try { $tcp.Connect('127.0.0.1', 27017); exit 0 } catch { exit 1 } finally { $tcp.Close() }" >nul 2>&1
if %errorlevel% neq 0 (
    REM Check if .env contains MongoDB Atlas string (mongodb+srv://)
    findstr /i "mongodb+srv" "apps\backend\.env" >nul 2>&1
    if %errorlevel% equ 0 (
        echo [3/6] MongoDB Atlas Cloud connection string detected in apps\backend\.env.
    ) else (
        echo.
        echo [WARNING] Local MongoDB is not running on 127.0.0.1:27017.
        echo If you have local MongoDB installed, start it with: net start MongoDB
        echo If not installed, you can:
        echo   1. Install local MongoDB: winget install MongoDB.Server
        echo   2. Or configure a free MongoDB Atlas cloud cluster in apps\backend\.env
        echo.
        echo Attempting to proceed with backend launch...
        echo.
    )
) else (
    echo [3/6] Local MongoDB active on port 27017.
)

REM -----------------------------------------------------------------------------
REM 4. Dependencies Check
REM -----------------------------------------------------------------------------
if not exist "node_modules\" (
    echo [4/6] Installing dependencies for first-time run...
    call npm.cmd install
    if errorlevel 1 goto ERR_NPM
    echo [4/6] Dependencies installed successfully.
) else (
    echo [4/6] Dependencies verified.
)

REM -----------------------------------------------------------------------------
REM 5. Build Artifacts Check
REM -----------------------------------------------------------------------------
if not exist "apps\backend\dist\main.js" goto DO_BUILD
if not exist "apps\web\.next\" goto DO_BUILD
echo [5/6] Build artifacts verified.
goto LAUNCH_SERVERS

:DO_BUILD
echo [5/6] Building backend and web workspaces...
call npm.cmd run build
if errorlevel 1 goto ERR_BUILD
echo [5/6] Build completed successfully.

REM -----------------------------------------------------------------------------
REM 6. Launch Servers & Open Browser
REM -----------------------------------------------------------------------------
:LAUNCH_SERVERS
echo [6/6] Launching Vanijya Platform...
echo.

REM Free up ports 4000 and 3000 if occupied to prevent EADDRINUSE
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000 "') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do taskkill /f /pid %%a >nul 2>&1

echo Starting Backend API (Port 4000)...
start "Vanijya Backend (Port 4000)" /D "%~dp0" cmd /k "node apps/backend/dist/main.js"

REM Wait for backend initialization and seeder completion
echo Waiting for backend database connection...
powershell -NoProfile -Command "for ($i=0; $i -lt 15; $i++) { try { $res = Invoke-RestMethod -Uri 'http://localhost:4000/api/health' -TimeoutSec 2 -ErrorAction Stop; if ($res.status -eq 'ok') { exit 0 } } catch {}; Start-Sleep -Seconds 1 }; exit 1" >nul 2>&1

echo Starting Unified Web Portal (Port 3000)...
start "Vanijya Web Portal (Port 3000)" /D "%~dp0" cmd /k "npm.cmd run start --workspace=apps/web"

REM Wait for web server
powershell -NoProfile -Command "Start-Sleep -Seconds 3"

REM Open browser to Unified Portal
start http://localhost:3000

echo.
echo ===============================================================================
echo   🌾 VANIJYA IS LIVE!
echo ===============================================================================
echo   - Unified Web Portal:     http://localhost:3000
echo   - Public Price Discovery: http://localhost:3000/prices
echo   - Common Login:           http://localhost:3000/login
echo   - User Signup & KYC:      http://localhost:3000/signup
echo   - Backend Health Check:   http://localhost:4000/api/health
echo   - Swagger API Docs:       http://localhost:4000/api/docs
echo ===============================================================================
echo.
echo   PRE-CONFIGURED DEMO CREDENTIALS:
echo   - Farmer: 9876543210        / Farmer@123  (Ramesh Patel - Nashik)
echo   - Buyer:  buyer@freshcart.com / asdfcv321   (FreshCart Agro Ltd.)
echo   - Admin:  admin@vanijya.gov.in / Admin@123  (Ministry Administrator)
echo ===============================================================================
echo.
echo Browser opened to http://localhost:3000.
echo You can close this launcher window. The background servers will continue running.
pause
exit /b 0

REM -----------------------------------------------------------------------------
REM Error Handlers
REM -----------------------------------------------------------------------------
:NO_NODE
echo.
echo [ERROR] Node.js is not installed or not found in your system PATH.
echo Please download and install Node.js (v18 or v20+ LTS) from: https://nodejs.org
echo.
pause
exit /b 1

:NO_NPM
echo.
echo [ERROR] npm is not found in your system PATH.
echo.
pause
exit /b 1

:ERR_NPM
echo.
echo [ERROR] npm install failed. Please check your internet connection and try again.
echo.
pause
exit /b 1

:ERR_BUILD
echo.
echo [ERROR] Application build failed. Review the TypeScript / build output above.
echo.
pause
exit /b 1
