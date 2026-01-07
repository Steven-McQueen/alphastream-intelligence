@echo off
echo Starting AlphaStream Intelligence Terminal...
echo.

REM Start backend in new window
start "AlphaStream Backend" cmd /k "cd /d C:\Users\andre\OneDrive\NHH\alphastream-intelligence-main\alphastream-backend && conda activate BAN405 && python main.py"

REM Wait 5 seconds for backend to start
timeout /t 5 /nobreak >nul

REM Start frontend in new window
start "AlphaStream Frontend" cmd /k "cd /d C:\Users\andre\OneDrive\NHH\alphastream-intelligence-main\alphastream-intelligence-frontend && conda activate BAN405 && npm run dev"

echo.
echo AlphaStream is starting up!
echo Backend: http://localhost:8000
echo Frontend: http://localhost:8080
echo.
