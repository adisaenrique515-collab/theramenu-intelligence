@echo off
echo Starting TheraMenu Production Stack...
echo Building Docker images and starting containers...

docker compose up -d --build
if %ERRORLEVEL% NEQ 0 (
    echo "docker compose" failed. Trying "docker-compose"...
    docker-compose up -d --build
)

echo.
echo Production stack is starting in the background.
echo Frontend will be available at: http://localhost:3000
echo API will be available at: http://localhost:8000
echo.
echo Run 'docker compose logs -f' or 'docker-compose logs -f' to view logs.
pause
