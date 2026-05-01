# ====================================================================
# GeoShield AI - ML Service Startup (PowerShell)
# ====================================================================

param(
    [string]$Environment = "development",
    [int]$Port = 8001,
    [switch]$NoReload = $false
)

# Configuration
$ML_SERVICE_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$ML_SERVICE_HOST = "0.0.0.0"
$HEALTH_CHECK_URL = "http://localhost:$Port/health"
$MAX_RETRIES = 30
$RETRY_INTERVAL = 2

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "GeoShield AI - ML Service Startup (PowerShell)" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

# Change to ML service directory
Push-Location $ML_SERVICE_DIR

# Check if .env file exists
$envFile = Join-Path $ML_SERVICE_DIR ".env"
$envExampleFile = Join-Path $ML_SERVICE_DIR ".env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExampleFile) {
        Write-Host "⚠️  .env file not found"
        Write-Host "📋 Copy the .env.example file and update it for your environment:" -ForegroundColor Yellow
        Write-Host "   Copy-Item '$envExampleFile' '$envFile'" -ForegroundColor Green
    }
}

Write-Host "📍 Starting ML Service on ${ML_SERVICE_HOST}:${Port}" -ForegroundColor Green
Write-Host "📁 Service Directory: $ML_SERVICE_DIR" -ForegroundColor Green
Write-Host ""

# Prepare uvicorn command
$uvicornArgs = @(
    "run",
    "app.main:app",
    "--host", $ML_SERVICE_HOST,
    "--port", $Port.ToString()
)

if ($Environment -eq "development" -and -not $NoReload) {
    $uvicornArgs += "--reload"
}

try {
    Write-Host "⏳ Starting uvicorn process..." -ForegroundColor Yellow
    
    # Start the ML service
    & python -m uvicorn @uvicornArgs
    
}
catch {
    Write-Host "❌ Error starting ML Service: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location
