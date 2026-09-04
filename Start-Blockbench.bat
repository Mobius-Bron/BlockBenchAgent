@echo off
title Blockbench MCP Launcher
cd /d "%~dp0"

echo ============================================
echo   Blockbench + MCP  One-Click Launcher
echo ============================================
echo.

rem Prefer PowerShell Core (pwsh), fall back to Windows PowerShell
set "PS_EXE=powershell"
where pwsh >nul 2>nul
if %errorlevel%==0 set "PS_EXE=pwsh"

%PS_EXE% -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-blockbench.ps1"

echo.
echo Done. The Blockbench window should be open now.
echo You can close this window (press any key).
pause >nul
