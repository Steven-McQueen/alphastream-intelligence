# Start a local Jupyter Server for AlphaStream Notebook integration.
#
# Do NOT double-click this file — Windows may open it in an editor.
# Instead use:
#   - start-notebook-server.bat  (uses python on PATH; good with Anaconda Prompt)
#   - start-notebook-server-conda.bat  (activates a named conda env automatically)
#
# From PowerShell:
#   cd alphastream-notebooks
#   .\start-notebook-server.ps1
#   .\start-notebook-server.ps1 -UseConda   # skip .venv; use current python (Anaconda)
#
# Usage: .\start-notebook-server.ps1 [-RootDir "..."] [-Port 8888] [-UseConda]

param(
    [string]$RootDir = "$env:USERPROFILE\alphastream-notebooks",
    [int]$Port = 8888,
    [switch]$UseConda
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path $RootDir)) {
    New-Item -ItemType Directory -Path $RootDir | Out-Null
    Write-Host "Created notebooks folder: $RootDir"
}

if ($UseConda) {
    $venvPython = (Get-Command python -ErrorAction Stop).Source
    Write-Host "Using conda/current Python: $venvPython" -ForegroundColor DarkGray
    python -c "import jupyter_server" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Installing requirements into current environment..."
        python -m pip install -r (Join-Path $ScriptDir "requirements.txt")
    }
} else {
    $venvPython = Join-Path $ScriptDir ".venv\Scripts\python.exe"
    if (-not (Test-Path $venvPython)) {
        Write-Host "Creating virtual environment in $ScriptDir\.venv ..."
        python -m venv (Join-Path $ScriptDir ".venv")
        & (Join-Path $ScriptDir ".venv\Scripts\pip.exe") install -r (Join-Path $ScriptDir "requirements.txt")
    }
}

$token = [guid]::NewGuid().ToString("N")
Write-Host ""
Write-Host "=== AlphaStream Jupyter Server ===" -ForegroundColor Cyan
Write-Host "URL:   http://localhost:$Port"
Write-Host "Token: $token"
Write-Host "Root:  $RootDir"
Write-Host ""
Write-Host "Paste URL + token into AlphaStream Notebook -> kernel connection settings."
Write-Host ""

$env:JUPYTER_CONFIG_DIR = $ScriptDir
& $venvPython -m jupyter server `
    --ServerApp.root_dir="$RootDir" `
    --ServerApp.port=$Port `
    --ServerApp.allow_origin="http://localhost:8080" `
    --ServerApp.allow_origin_pat="http://localhost:(8080|5173)" `
    --ServerApp.disable_check_xsrf=True `
    --IdentityProvider.token="$token" `
    --no-browser
