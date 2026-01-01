# Start simple HTTP server for this project (PowerShell)
Param(
    [int]$Port = 5173
)

Write-Host "Starting local HTTP server on port $Port..."

if (Get-Command python -ErrorAction SilentlyContinue) {
    python -m http.server $Port
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    py -3 -m http.server $Port
} else {
    Write-Host "Python not found. Try installing Python or use 'npx http-server' if Node is available." -ForegroundColor Yellow
    Write-Host "Fallback: try 'npx http-server -p $Port'"
}
