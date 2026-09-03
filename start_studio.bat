@echo off
set PYTHONUNBUFFERED=1
title OmniShield Studio Anti-Detect Engine
echo ========================================================
echo   OmniShield Anti-Detect Browser Studio Launcher
echo ========================================================
echo.
echo Starting Anti-Detect Server on http://localhost:3000...
echo.

start http://localhost:3000
python server.py

pause
