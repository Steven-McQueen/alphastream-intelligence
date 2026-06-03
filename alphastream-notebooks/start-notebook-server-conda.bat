@echo off
REM For Anaconda: edit CONDA_ENV below, then double-click OR run from any folder.

set "CONDA_ENV=base"
set "ROOT_DIR=%USERPROFILE%\alphastream-notebooks"
set "PORT=8888"

cd /d "%~dp0"

REM Typical Anaconda install paths (adjust if yours differs)
set "CONDA_ROOT=%USERPROFILE%\anaconda3"
if not exist "%CONDA_ROOT%\Scripts\activate.bat" set "CONDA_ROOT=%USERPROFILE%\miniconda3"
if not exist "%CONDA_ROOT%\Scripts\activate.bat" set "CONDA_ROOT=C:\ProgramData\anaconda3"
if not exist "%CONDA_ROOT%\Scripts\activate.bat" (
    echo Could not find Anaconda. Edit CONDA_ROOT in this .bat file.
    pause
    exit /b 1
)

call "%CONDA_ROOT%\Scripts\activate.bat" %CONDA_ENV%
if errorlevel 1 (
    echo Failed to activate conda env: %CONDA_ENV%
    echo Edit CONDA_ENV at the top of this file.
    pause
    exit /b 1
)

if not exist "%ROOT_DIR%" mkdir "%ROOT_DIR%"

python -c "import jupyter_server" >nul 2>&1
if errorlevel 1 (
    echo Installing packages into conda env %CONDA_ENV% ...
    python -m pip install -r "%~dp0requirements.txt"
)

for /f %%i in ('python -c "import secrets; print(secrets.token_hex(32))"') do set "TOKEN=%%i"

echo.
echo === AlphaStream Jupyter Server (Conda: %CONDA_ENV%) ===
echo URL:   http://localhost:%PORT%
echo Token: %TOKEN%
echo Root:  %ROOT_DIR%
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

pause
