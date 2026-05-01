# debug-coordinate-flow.ps1
# PowerShell script to debug coordinate flow through the system

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "COORDINATE FLOW DEBUGGING - QUICK START" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check backend
Write-Host "Step 1: Checking if backend is running..." -ForegroundColor Blue
try {
    $null = Invoke-WebRequest -Uri "http://localhost:8080/health" -ErrorAction Stop
    Write-Host "✓ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend not running!" -ForegroundColor Red
    Write-Host "Start it with: cd server && npm run dev" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Step 2: Check ML service
Write-Host "Step 2: Checking if ML service is running..." -ForegroundColor Blue
try {
    $null = Invoke-WebRequest -Uri "http://localhost:8001/health" -ErrorAction Stop
    Write-Host "✓ ML service is running" -ForegroundColor Green
} catch {
    Write-Host "❌ ML service not running!" -ForegroundColor Red
    Write-Host "Start it with: cd ml-services/ml-service && python app/main.py" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Step 3: Get auth token
Write-Host "Step 3: Getting authentication token..." -ForegroundColor Blue
$Email = Read-Host "Enter your email (e.g., user@test.com)"
$Password = Read-Host "Enter your password" -AsSecureString
$PasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($Password))

$LoginBody = @{
    email = $Email
    password = $PasswordPlain
} | ConvertTo-Json

try {
    $LoginResponse = Invoke-WebRequest -Uri "http://localhost:8080/api/auth/login" `
        -Method POST `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $LoginBody
    
    $LoginData = $LoginResponse.Content | ConvertFrom-Json
    $TOKEN = $LoginData.token
    
    Write-Host "✓ Login successful" -ForegroundColor Green
    Write-Host "Token: $($TOKEN.Substring(0, [Math]::Min(20, $TOKEN.Length)))..." -ForegroundColor Yellow
} catch {
    Write-Host "❌ Login failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Test with different coordinates
Write-Host "Step 4: Testing coordinate flow with 3 different locations..." -ForegroundColor Blue
Write-Host ""

$Locations = @(
    @{coords = "16.5,73.85"; name = "Mumbai"},
    @{coords = "21.1458,79.0882"; name = "Nagpur"},
    @{coords = "18.5204,73.8567"; name = "Pune"}
)

foreach ($Location in $Locations) {
    $Lat, $Lon = $Location.coords -split ','
    $Name = $Location.name
    
    Write-Host "Testing: $Name ($Lat, $Lon)" -ForegroundColor Yellow
    
    $PredictionBody = @{
        latitude = [float]$Lat
        longitude = [float]$Lon
    } | ConvertTo-Json
    
    Write-Host "Sending request..."
    
    try {
        $PredictionResponse = Invoke-WebRequest -Uri "http://localhost:8080/api/predictions" `
            -Method POST `
            -Headers @{
                "Content-Type" = "application/json"
                "Authorization" = "Bearer $TOKEN"
            } `
            -Body $PredictionBody
        
        $PredictionData = $PredictionResponse.Content | ConvertFrom-Json
        
        Write-Host "Response:" -ForegroundColor Green
        Write-Host "  Risk Level: $($PredictionData.prediction.riskLevel)" -ForegroundColor Green
        Write-Host "  Probability: $('{0:P1}' -f $PredictionData.prediction.probability)" -ForegroundColor Green
        Write-Host "  Confidence: $([math]::Round($PredictionData.prediction.confidence, 2))" -ForegroundColor Green
        
    } catch {
        Write-Host "❌ Request failed!" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Start-Sleep -Seconds 2  # Wait 2 seconds between requests
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Debugging instructions:" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. FRONTEND LOGS (React DevTools):" -ForegroundColor Yellow
Write-Host "   - Press F12 in browser" -ForegroundColor Gray
Write-Host "   - Go to Console tab" -ForegroundColor Gray
Write-Host "   - Look for lines starting with '🟢'" -ForegroundColor Gray
Write-Host "   - Compare coordinates for each request" -ForegroundColor Gray
Write-Host ""
Write-Host "2. BACKEND LOGS (PowerShell terminal):" -ForegroundColor Yellow
Write-Host "   - In the terminal running 'npm run dev':" -ForegroundColor Gray
Write-Host "   - Look for lines starting with '🔵' (controller)" -ForegroundColor Gray
Write-Host "   - Look for lines starting with '🟠' (ML service)" -ForegroundColor Gray
Write-Host "   - Look for lines starting with '🟡' (weather/elevation)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. ML SERVICE LOGS:" -ForegroundColor Yellow
Write-Host "   - In the terminal running 'python app/main.py':" -ForegroundColor Gray
Write-Host "   - Look for lines starting with '🟣'" -ForegroundColor Gray
Write-Host ""

Write-Host "COMMON ISSUES TO CHECK:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Problem: All 3 locations return SAME risk level" -ForegroundColor Red
Write-Host "Solution: Check elevation cache hits - search backend logs for 'Cache HIT'" -ForegroundColor Yellow
Write-Host ""
Write-Host "Problem: Frontend sends different coords, backend logs same coords" -ForegroundColor Red
Write-Host "Solution: Issue in request body modification - check 🔵 BACKEND logs" -ForegroundColor Yellow
Write-Host ""
Write-Host "Problem: Different coords but ML returns identical prediction" -ForegroundColor Red
Write-Host "Solution: Check if weather API returns same response - look at 🟡 logs" -ForegroundColor Yellow
Write-Host ""
