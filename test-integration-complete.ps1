# Integration Test Script
# Tests the complete flow: Client → Backend → ML (in backend) → Response

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   INTEGRATED ML PREDICTION TEST" -ForegroundColor Cyan
Write-Host "   (ML runs directly in Node.js backend)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"
$baseUrl = "http://localhost:8080/api"

# Test coordinates
$latitude = 30.7333
$longitude = 76.7794

Write-Host "Test Location: Chandigarh, India" -ForegroundColor Yellow
Write-Host "Coordinates: [$latitude, $longitude]" -ForegroundColor Yellow
Write-Host ""

# Step 1: Test Backend Health
Write-Host "[1/4] Testing Backend Server..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8080/health" -Method Get -ErrorAction Stop
    Write-Host "  ✓ Backend server is running" -ForegroundColor Green
    Write-Host "    Status: $($health.status)" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Backend server is NOT running!" -ForegroundColor Red
    Write-Host "    Please start the backend: cd server && npm run dev" -ForegroundColor Yellow
    exit 1
}

# Step 2: Test Python Environment
Write-Host "`n[2/4] Testing Python Environment..." -ForegroundColor Cyan
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  ✓ Python is available: $pythonVersion" -ForegroundColor Green
    
    # Check required packages
    $packages = @("numpy", "pandas", "scikit-learn")
    foreach ($pkg in $packages) {
        $check = python -c "import $pkg; print($pkg.__version__)" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    ✓ $pkg installed" -ForegroundColor Green
        } else {
            Write-Host "    ✗ $pkg NOT installed!" -ForegroundColor Red
            Write-Host "      Install: pip install $pkg" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "  ✗ Python is NOT available!" -ForegroundColor Red
    Write-Host "    Please install Python 3.9+" -ForegroundColor Yellow
}

# Step 3: Test Authentication
Write-Host "`n[3/4] Testing Authentication..." -ForegroundColor Cyan
$testEmail = "test@example.com"
$testPassword = "Test@1234"

# Try to signup
try {
    $signupBody = @{
        name = "Test User"
        email = $testEmail
        password = $testPassword
        role = "user"
    } | ConvertTo-Json

    $signupResponse = Invoke-RestMethod -Uri "$baseUrl/auth/signup" -Method Post -Body $signupBody -ContentType "application/json" -ErrorAction SilentlyContinue
    Write-Host "  ✓ User registered" -ForegroundColor Green
} catch {
    # User might already exist, try login
}

# Login
try {
    $loginBody = @{
        email = $testEmail
        password = $testPassword
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -ErrorAction Stop
    $token = $loginResponse.token
    Write-Host "  ✓ Authentication successful" -ForegroundColor Green
    Write-Host "    Token: $($token.Substring(0, 20))..." -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Authentication failed!" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Yellow
    exit 1
}

# Step 4: Test Integrated Prediction
Write-Host "`n[4/4] Testing Integrated Prediction (50% API + 40% ML + 10% Historical)..." -ForegroundColor Cyan
try {
    $predictionBody = @{
        latitude = $latitude
        longitude = $longitude
    } | ConvertTo-Json

    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

    Write-Host "  → Sending prediction request..." -ForegroundColor Gray
    $prediction = Invoke-RestMethod -Uri "$baseUrl/predictions" -Method Post -Body $predictionBody -Headers $headers -ErrorAction Stop
    
    Write-Host "  ✓ Prediction completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  PREDICTION RESULTS" -ForegroundColor Cyan
    Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Risk Level:    $($prediction.prediction.riskLevel)" -ForegroundColor $(
        switch ($prediction.prediction.riskLevel) {
            "LOW" { "Green" }
            "MODERATE" { "Yellow" }
            "HIGH" { "Red" }
            "CRITICAL" { "Magenta" }
            default { "White" }
        }
    )
    Write-Host "  Probability:   $(($prediction.prediction.probability * 100).ToString('F2'))%" -ForegroundColor White
    Write-Host "  Confidence:    $(($prediction.prediction.confidence * 100).ToString('F2'))%" -ForegroundColor White
    Write-Host ""
    
    if ($prediction.breakdown) {
        Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
        Write-Host "  BREAKDOWN (50% API + 40% ML + 10% Historical)" -ForegroundColor Cyan
        Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
        Write-Host ""
        
        Write-Host "  API Data (50%):" -ForegroundColor Yellow
        Write-Host "    Score:        $(($prediction.breakdown.api.score * 100).ToString('F2'))%" -ForegroundColor White
        Write-Host "    Contribution: $(($prediction.breakdown.api.contribution * 100).ToString('F2'))%" -ForegroundColor White
        if ($prediction.breakdown.api.data) {
            Write-Host "    Temperature:  $($prediction.breakdown.api.data.temperature)°C" -ForegroundColor Gray
            Write-Host "    Humidity:     $($prediction.breakdown.api.data.humidity)%" -ForegroundColor Gray
            Write-Host "    Rainfall 24h: $($prediction.breakdown.api.data.rainfall24h) mm" -ForegroundColor Gray
            Write-Host "    Earthquakes:  $($prediction.breakdown.api.data.earthquakeCount)" -ForegroundColor Gray
        }
        Write-Host ""
        
        Write-Host "  ML Model (40%):" -ForegroundColor Yellow
        Write-Host "    Score:        $(($prediction.breakdown.ml.score * 100).ToString('F2'))%" -ForegroundColor White
        Write-Host "    Contribution: $(($prediction.breakdown.ml.contribution * 100).ToString('F2'))%" -ForegroundColor White
        Write-Host "    ML Risk Level: $($prediction.breakdown.ml.riskLevel)" -ForegroundColor Gray
        Write-Host "    ML Confidence: $(($prediction.breakdown.ml.confidence * 100).ToString('F2'))%" -ForegroundColor Gray
        Write-Host ""
        
        Write-Host "  Historical CSV (10%):" -ForegroundColor Yellow
        Write-Host "    Score:        $(($prediction.breakdown.historical.score * 100).ToString('F2'))%" -ForegroundColor White
        Write-Host "    Contribution: $(($prediction.breakdown.historical.contribution * 100).ToString('F2'))%" -ForegroundColor White
        Write-Host "    Source:       $($prediction.breakdown.historical.source)" -ForegroundColor Gray
        Write-Host ""
    }
    
    Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    
} catch {
    Write-Host "  ✗ Prediction failed!" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Yellow
    if ($_.ErrorDetails) {
        Write-Host "    Details: $($_.ErrorDetails)" -ForegroundColor Yellow
    }
    exit 1
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  ✓ INTEGRATION TEST COMPLETED SUCCESSFULLY" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Test from frontend: Start client (npm run dev) and click on map" -ForegroundColor White
Write-Host "2. Check logs in: server/logs/*.log" -ForegroundColor White
Write-Host "3. Verify predictions are stored in MongoDB" -ForegroundColor White
Write-Host ""
