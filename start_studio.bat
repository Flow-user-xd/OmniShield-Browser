@echo off
setlocal enabledelayedexpansion
title OmniShield Anti-Detect Studio Launcher

echo ===================================================================
echo       🛡️  OmniShield Studio — Automatic Environment Setup
echo ===================================================================
echo.

:: 1. Verify Python Installation
python --version >nul 2>nul
if %errorlevel% neq 0 (
    echo [OmniShield] Python 3 was not detected on this system.
    echo [OmniShield] Installing Python 3 automatically...
    echo.
    
    :: Attempt winget first
    winget --version >nul 2>nul
    if %errorlevel% equ 0 (
        echo [OmniShield] Using Windows Package Manager (winget)...
        winget install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements --silent
    ) else (
        echo [OmniShield] Downloading official Python installer...
        powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe', '%TEMP%\py_install.exe')"
        echo [OmniShield] Running quiet installer...
        "%TEMP%\py_install.exe" /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
        if exist "%TEMP%\py_install.exe" del "%TEMP%\py_install.exe"
    )

    :: Refresh local environment PATH for current session
    set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;C:\Program Files\Python312;C:\Program Files\Python312\Scripts;%PATH%"
    
    python --version >nul 2>nul
    if %errorlevel% neq 0 (
        echo.
        echo [OmniShield Error] Python installation could not be completed automatically.
        echo Please install Python 3.10+ from https://www.python.org/downloads/ and check 'Add Python to PATH'.
        echo.
        pause
        exit /b 1
    )
    echo [OmniShield] Python installed successfully!
    echo.
)

:: 2. Verify Python Dependencies
if exist "requirements.txt" (
    echo [OmniShield] Checking Python dependencies...
    python -m pip install -q -r requirements.txt
    if %errorlevel% neq 0 (
        echo [OmniShield Warning] Error installing some dependencies. Retrying...
        python -m pip install -r requirements.txt
    )
)

:: 3. Verify Portable Chromium Browser Core
if not exist "browser_core\chrome.exe" (
    echo.
    echo [OmniShield] Portable Chromium browser engine not found in browser_core\
    python setup_portable_chromium.py --interactive
    if not exist "browser_core\chrome.exe" (
        echo.
        echo [OmniShield Error] Chromium installation failed or was cancelled.
        pause
        exit /b 1
    )
)

:: 4. Launch OmniShield Studio
echo.
echo ===================================================================
echo   Starting OmniShield Studio Server on http://localhost:3000...
echo ===================================================================
echo.

start http://localhost:3000
python server.py

pause
