@echo off
set PORT=5173
echo Starting local HTTP server on port %PORT%...
where python >nul 2>nul
if %errorlevel%==0 (
    python -m http.server %PORT%
    goto :eof
)
where py >nul 2>nul
if %errorlevel%==0 (
    py -3 -m http.server %PORT%
    goto :eof
)
echo Python not found. If Node.js is installed, run: npx http-server -p %PORT%
echo Or install Python from https://www.python.org/
