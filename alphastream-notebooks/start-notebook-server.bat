@echo off
REM Double-click this file, OR run from Anaconda Prompt / CMD after: cd alphastream-notebooks
REM Uses whatever "python" is on your PATH (Anaconda env when Prompt is activated).

setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "ROOT_DIR=%USERPROFILE%\alphastream-notebooks"
set "PORT=8888"

if not "%~1"=="" set "ROOT_DIR=%~1"
if not "%~2"=="" set "PORT=%~2"

if not exist "%ROOT_DIR%" mkdir "%ROOT_DIR%"

where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: python not found on PATH.
    echo Open "Anaconda Prompt", run: conda activate YOUR_ENV
    echo Then run this script again from that window.
    pause
    exit /b 1
)

python -c "import jupyter_server" >nul 2>&1
if errorlevel 1 (
    echo Installing Jupyter into the current Python environment...
    python -m pip install -r "%~dp0requirements.txt"
    if errorlevel 1 (
        echo pip install failed.
        pause
        exit /b 1
    )
)

for /f %%i in ('python -c "import secrets; print(secrets.token_hex(32))"') do set "TOKEN=%%i"

echo.
echo === AlphaStream Jupyter Server ===
echo URL:   http://localhost:%PORT%
echo Token: %TOKEN%
echo Root:  %ROOT_DIR%
echo.
echo Paste URL + token into AlphaStream Notebook - kernel connection settings.
echo Keep this window open while using the Notebook page.
echo.

set "JUPYTER_CONFIG_DIR=%~dp0"
python -m jupyter server ^
  --ServerApp.root_dir="%ROOT_DIR%" ^
  --ServerApp.port=%PORT% ^
  --ServerApp.allow_origin="http://localhost:8080" ^
  --ServerApp.allow_origin_pat="http://localhost:(8080|5173)" ^
  --ServerApp.disable_check_xsrf=True ^
  --IdentityProvider.token="%TOKEN%" ^
  --no-browser

echo.
echo Server stopped.
pause
