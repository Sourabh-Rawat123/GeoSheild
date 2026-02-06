#!/usr/bin/env pwsh
# GeoShield AI - Integration Test Script
# Tests all services and the complete data flow

Write-Host "🚀 GeoShield AI - Integration Test Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$failed = $false

# Function to test endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$ExpectedStatus = 200
    )
    
    Write-Host "Testing: $Name" -NoNewline
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host " ✅" -ForegroundColor Green
            return $true
        } else {
            Write-Host " ❌ (Status: $($response.StatusCode))" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host " ❌ (Error: $($_.Exception.Message))" -ForegroundColor Red
        return $false
    }
}

Write-Host "Step 1: Testing Services" -ForegroundColor Yellow
Write-Host "------------------------" -ForegroundColor Yellow

# Note: ML is integrated directly in backend - no separate ML service needed
Write-Host "ℹ️  ML runs directly in backend (no separate service)" -ForegroundColor Cyan

# Test Backend
if (-not (Test-Endpoint "Backend Server (port 8080)" "http://localhost:8080/health")) {
    Write-Host "   💡 Start backend: cd server && npm run dev" -ForegroundColor Gray
    $failed = $true
}

# Test Frontend
if (-not (Test-Endpoint "Frontend (port 5173)" "http://localhost:5173")) {
    Write-Host "   💡 Start frontend: cd client && npm run dev" -ForegroundColor Gray
    $failed = $true
}

Write-Host ""
Write-Host "Step 2: Testing External APIs" -ForegroundColor Yellow
Write-Host "-----------------------------" -ForegroundColor Yellow

# Test OpenWeatherMap (check if key is configured)
$envFile = Get-Content "server\.env" -ErrorAction SilentlyContinue
$apiKey = ($envFile | Select-String "OPENWEATHER_API_KEY=(.+)" -AllMatches).Matches.Groups[1].Value

if ($apiKey) {
    Write-Host "OpenWeatherMap API Key: Configured ✅" -ForegroundColor Green
    
    # Test actual API call
    try {
        $weatherTest = Invoke-RestMethod -Uri "https://api.openweathermap.org/data/2.5/weather?lat=30.7333&lon=76.7794&appid=$apiKey" -TimeoutSec 5
        Write-Host "   API Call Test: Success ✅" -ForegroundColor Green
    } catch {
        Write-Host "   API Call Test: Failed ❌" -ForegroundColor Red
        Write-Host "   💡 Check if API key is valid" -ForegroundColor Gray
    }
} else {
    Write-Host "OpenWeatherMap API Key: Not configured ⚠️" -ForegroundColor Yellow
    Write-Host "   💡 Add OPENWEATHER_API_KEY to server/.env" -ForegroundColor Gray
}

# Test USGS Earthquake API
if (Test-Endpoint "USGS Earthquake API" "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2026-01-01&latitude=30.73&longitude=76.77&maxradiuskm=100&limit=1") {
    Write-Host "   USGS API: Available ✅" -ForegroundColor Green
}

# Test Open Elevation API
try {
    $elevTest = Invoke-RestMethod -Uri "https://api.open-elevation.com/api/v1/lookup" -Method POST -Body '{"locations":[{"latitude":30.7333,"longitude":76.7794}]}' -ContentType "application/json" -TimeoutSec 10
    Write-Host "Open Elevation API: Available ✅" -ForegroundColor Green
} catch {
    Write-Host "Open Elevation API: Failed ❌" -ForegroundColor Red
}

Write-Host ""
Write-Host "Step 3: Testing Database" -ForegroundColor Yellow
Write-Host "-----------------------" -ForegroundColor Yellow

# Check MongoDB
try {
    $mongoStatus = Get-Service MongoDB -ErrorAction SilentlyContinue
    if ($mongoStatus -and $mongoStatus.Status -eq "Running") {
        Write-Host "MongoDB: Running ✅" -ForegroundColor Green
    } else {
        Write-Host "MongoDB: Not running ❌" -ForegroundColor Red
        Write-Host "   💡 Start MongoDB: net start MongoDB" -ForegroundColor Gray
        $failed = $true
    }
} catch {
    Write-Host "MongoDB: Status unknown ⚠️" -ForegroundColor Yellow
    Write-Host "   💡 Check if MongoDB is installed" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Step 4: Integration Test" -ForegroundColor Yellow
Write-Host "-----------------------" -ForegroundColor Yellow

if ($failed) {
    Write-Host "⚠️  Cannot run integration test - fix services first" -ForegroundColor Yellow
} else {
    Write-Host "Creating test user..." -NoNewline
    
    # Create test user
    $signupBody = @{
        name = "Integration Test User"
        email = "integration.test@geoshield.ai"
        password = "testpass123"
    } | ConvertTo-Json
    
    try {
        $signupResponse = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/signup" -Method POST -Body $signupBody -ContentType "application/json" -ErrorAction SilentlyContinue
        Write-Host " ✅" -ForegroundColor Green
    } catch {
        if ($_.Exception.Message -like "*400*") {
            Write-Host " (User already exists, trying login...)" -ForegroundColor Gray
        } else {
            Write-Host " ❌" -ForegroundColor Red
            Write-Host $_.Exception.Message
        }
    }
    
    # Login
    Write-Host "Logging in..." -NoNewline
    $loginBody = @{
        email = "integration.test@geoshield.ai"
        password = "testpass123"
    } | ConvertTo-Json
    
    try {
        $loginResponse = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
        $token = $loginResponse.token
        Write-Host " ✅" -ForegroundColor Green
        
        # Test Integrated Prediction (API + ML + Historical)
        Write-Host "Testing Integrated Prediction (50% API + 40% ML + 10% Historical)..." -NoNewline
        
        $predictionBody = @{
            latitude = 30.7333
            longitude = 76.7794
        } | ConvertTo-Json
        
        $headers = @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        }
        
        try {
            $predictionResponse = Invoke-RestMethod -Uri "http://localhost:8080/api/predictions" -Method POST -Body $predictionBody -Headers $headers -TimeoutSec 30
            
            Write-Host " ✅" -ForegroundColor Green
            Write-Host ""
            Write-Host "🎉 INTEGRATION TEST PASSED!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Prediction Results:" -ForegroundColor Cyan
            Write-Host "==================" -ForegroundColor Cyan
            Write-Host "Risk Level: $($predictionResponse.prediction.riskLevel)" -ForegroundColor $(if ($predictionResponse.prediction.riskLevel -eq "High" -or $predictionResponse.prediction.riskLevel -eq "Severe") { "Red" } else { "Yellow" })
            Write-Host "Probability: $([math]::Round($predictionResponse.prediction.probability * 100, 2))%"
            Write-Host "Confidence: $([math]::Round($predictionResponse.prediction.confidence * 100, 2))%"
            Write-Host ""
            Write-Host "Breakdown:" -ForegroundColor Cyan
            Write-Host "  API (50%): Score = $([math]::Round($predictionResponse.prediction.breakdown.api.score * 100, 2))%"
            Write-Host "    Factors: $($predictionResponse.prediction.breakdown.api.factors -join ', ')"
            Write-Host "  ML (40%): Score = $([math]::Round($predictionResponse.prediction.breakdown.ml.score * 100, 2))%"
            Write-Host "  Historical (10%): Score = $([math]::Round($predictionResponse.prediction.breakdown.historical.score * 100, 2))%"
            Write-Host "    Incidents nearby: $($predictionResponse.prediction.breakdown.historical.incidentCount)"
            Write-Host ""
            Write-Host "✅ All systems integrated successfully!" -ForegroundColor Green
            
        } catch {
            Write-Host " ❌" -ForegroundColor Red
            Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        }
        
    } catch {
        Write-Host " ❌" -ForegroundColor Red
        Write-Host "Login failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Test complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Open http://localhost:5173 in your browser"
Write-Host "2. Login with your credentials"
Write-Host "3. Navigate to Risk Map"
Write-Host "4. Click on the map to get a hybrid prediction"
Write-Host ""
