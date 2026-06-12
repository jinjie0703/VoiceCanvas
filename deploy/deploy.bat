@echo off
chcp 65001 >nul
echo =============================================
echo    VoiceCanvas Windows Deployment Script       
echo =============================================
echo.
echo Please select a deployment method:
echo   1. Deploy using Docker (Recommended)
echo   2. Deploy Manually (Requires Go ^& Node.js)
echo.
set /p OPTION="Enter your choice (1 or 2): "

if "%OPTION%"=="1" (
    echo.
    echo ^>^>^> Starting Docker deployment...
    
    REM Check if docker is installed
    where docker >nul 2>nul
    if errorlevel 1 (
        echo [Error] Docker is not installed. Please install Docker Desktop first.
        pause
        exit /b 1
    )

    docker-compose up -d --build
    if errorlevel 1 (
        echo [Error] Failed to start docker-compose. Please ensure Docker engine is running.
        pause
        exit /b 1
    )
    
    echo.
    echo [Success] Docker deployment started successfully!
    echo [Info] Access the frontend at: http://localhost
    echo [Info] Backend WebSocket at: ws://localhost:8080/ws
    pause
    exit /b 0
)

if "%OPTION%"=="2" (
    echo.
    echo ^>^>^> Starting Manual Build Process...
    
    where go >nul 2>nul
    if errorlevel 1 (
        echo [Error] Go is not installed. Please install Go.
        pause
        exit /b 1
    )
    
    where npm >nul 2>nul
    if errorlevel 1 (
        echo [Error] Node.js/npm is not installed. Please install Node.js.
        pause
        exit /b 1
    )
    
    echo.
    echo [1/2] Building Backend...
    cd backend
    go build -o voice-canvas-backend.exe main.go
    cd ..
    
    echo.
    echo [2/2] Building Frontend...
    cd frontend
    call npm install
    call npm run build
    cd ..
    
    echo.
    echo [Success] Manual build complete!
    echo.
    echo To run the services, you will need two Command Prompts or PowerShell windows:
    echo.
    echo   Terminal 1 (Backend):
    echo     cd backend
    echo     set DASHSCOPE_API_KEY=your_key_here
    echo     voice-canvas-backend.exe
    echo.
    echo   Terminal 2 (Frontend - Dev Mode):
    echo     cd frontend
    echo     npm run dev
    echo.
    echo Note: For production manual deployment on IIS/Nginx, serve the 'frontend/dist' folder.
    pause
    exit /b 0
)

echo [Error] Invalid option selected.
pause
exit /b 1
