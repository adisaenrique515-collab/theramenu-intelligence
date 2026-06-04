@echo off
REM ── Recipe Intelligence API launcher ─────────────────────────────────────
REM Starts the Python FastAPI server (port 8000).
REM Docs at http://localhost:8000/docs

cd /d "%~dp0"

where python >nul 2>&1
IF ERRORLEVEL 1 (
    echo [ERROR] Python not found. Install Python 3.10+ and try again.
    pause
    exit /b 1
)

IF NOT EXIST "database\recipe_intelligence.sqlite" (
    echo [INFO] Database not found. Seeding from CSV...
    cd database
    python seed_from_csv.py
    cd ..
)

echo [INFO] Starting Recipe Intelligence API at http://localhost:8000
uvicorn api.app:app --reload --port 8000
