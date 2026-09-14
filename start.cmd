@echo off
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel% equ 0 (
  node scripts\serve.mjs
) else (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\serve.mjs
  ) else (
    echo Node.js is required. Install Node.js, then open this file again.
  )
)
pause
