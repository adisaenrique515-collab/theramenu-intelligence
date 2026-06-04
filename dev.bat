@echo off
REM ── TheraMenu dev launcher ────────────────────────────────────────────────
REM Starts the Thera-menu-main Vite dev server (port 3000).
REM The server handles all /api/* routes internally via the Vite middleware.

cd /d "%~dp0Thera-menu-main"

IF NOT EXIST ".env.local" (
    echo [WARN] No .env.local found. Copy .env.example to .env.local and add your API keys.
    echo       Running in MOCK (offline) mode.
    echo.
)

IF NOT EXIST "node_modules" (
    echo [INFO] node_modules not found. Running npm install first...
    npm install
)

echo [INFO] Starting TheraMenu dev server at http://localhost:3000
npm run dev
