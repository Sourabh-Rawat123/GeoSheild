# Coordinate Flow Debugging Guide

## 1. FRONTEND LOGGING (React)

### Dashboard.jsx - Auto Location Mode
```javascript
// Add this logging in the useEffect that triggers prediction:
useEffect(() => {
    const [lon, lat] = user.location.coordinates;
    
    console.log('🟢 FRONTEND: Dashboard.jsx - fetchSinglePrediction called');
    console.log('  Timestamp:', new Date().toISOString());
    console.log('  Latitude:', lat);
    console.log('  Longitude:', lon);
    console.log('  Full coordinates object:', { lat, lon });
    console.log('  User location from store:', user.location);
    
    dispatch(fetchSinglePrediction({ latitude: lat, longitude: lon }));
}, [dispatch, user?.location?.coordinates?.[0], user?.location?.coordinates?.[1]]);
```

### RouteAnalysis.jsx - Route Mode
```javascript
// Add this in the prediction loop (after sampledCoords creation):
console.log(`🟢 FRONTEND: RouteAnalysis.jsx - Processing ${sampledCoords.length} sampled points`);

const predictionsPromises = sampledCoords.map((coord, index) => {
    console.log(`🟢 FRONTEND: RouteAnalysis.jsx - Point ${index}/${sampledCoords.length}`);
    console.log(`  Timestamp: ${new Date().toISOString()}`);
    console.log(`  Latitude: ${coord.lat}`);
    console.log(`  Longitude: ${coord.lng}`);
    console.log(`  Full coord object:`, coord);
    
    return axios.post(`${API_URL}/predictions`, {
        latitude: coord.lat,
        longitude: coord.lng
    }, {
        headers: { Authorization: `Bearer ${token}` }
    }).catch(err => {
        console.error(`❌ FRONTEND: RouteAnalysis.jsx - Prediction failed for [${coord.lat}, ${coord.lng}]`, err);
        return null;
    })
});
```

---

## 2. BACKEND LOGGING (Express)

### predictionController.js - Entry Point
```javascript
exports.getPrediction = asyncHandler(async (req, res) => {
    const { latitude, longitude } = req.body;
    
    console.log('🔵 BACKEND: predictionController.js - POST /api/predictions received');
    console.log('  Timestamp:', new Date().toISOString());
    console.log('  User ID:', req.user.id);
    console.log('  Request body (raw):', req.body);
    console.log('  Extracted latitude:', latitude);
    console.log('  Extracted longitude:', longitude);
    console.log('  Latitude type:', typeof latitude);
    console.log('  Longitude type:', typeof longitude);
    
    if (!latitude || !longitude) {
        throw new ApiError('Latitude and longitude are required', 400);
    }

    logger.info('🔵 BACKEND: Calling integratedMLService.predict()', { latitude, longitude });
    
    const result = await integratedMLService.predict(latitude, longitude);
    
    // ... rest of code
});
```

### integratedMLService.js - Prediction Orchestration
```javascript
async predict(latitude, longitude) {
    try {
        console.log('🟠 BACKEND: integratedMLService.predict() called');
        console.log('  Timestamp:', new Date().toISOString());
        console.log('  Latitude:', latitude);
        console.log('  Longitude:', longitude);
        console.log('  Latitude type:', typeof latitude);
        console.log('  Longitude type:', typeof longitude);
        console.log('  Math.abs(latitude):', Math.abs(latitude));
        console.log('  Math.abs(longitude):', Math.abs(longitude));

        logger.info('Starting integrated prediction', { latitude, longitude });

        // Step 1: Get API data (50% weight)
        console.log('🟠 BACKEND: Calling getAPIData()');
        const apiData = await this.getAPIData(latitude, longitude);
        
        logger.info('🟠 BACKEND: getAPIData() returned', { 
            elevation: apiData.terrain.elevation,
            rainfall24h: apiData.weather.rainfall24h,
            earthquakeCount: apiData.seismic.count
        });

        // ... rest of code
    }
}

async getAPIData(latitude, longitude) {
    try {
        console.log('🟠 BACKEND: integratedMLService.getAPIData() called');
        console.log('  Latitude:', latitude);
        console.log('  Longitude:', longitude);

        const [weather, seismic, elevation] = await Promise.all([
            weatherService.getCurrentWeather(latitude, longitude),
            weatherService.getEarthquakeData(latitude, longitude, 100),
            weatherService.getElevationData(latitude, longitude)
        ]);

        logger.info('🟠 BACKEND: API data fetched', {
            temperature: weather.main?.temp,
            elevation: elevation.elevation,
            earthquakes: seismic.count
        });

        return { weather, seismic, terrain: { elevation: elevation.elevation, slope: elevation.slope } };
    } catch (error) {
        logger.warn('API data fetch failed', { error: error.message });
        return { /* defaults */ };
    }
}
```

### weatherService.js - API Calls
```javascript
async getCurrentWeather(latitude, longitude) {
    try {
        console.log('🟡 BACKEND: weatherService.getCurrentWeather() called');
        console.log('  Latitude:', latitude);
        console.log('  Longitude:', longitude);
        
        const response = await axios.get(OPENWEATHER_URL, {
            params: {
                lat: latitude,
                lon: longitude,
                appid: this.apiKey,
            },
            timeout: 10000,
        });

        logger.info('🟡 BACKEND: OpenWeather API response received', {
            temp: response.data.main?.temp,
            coords: { lat: response.data.coord?.lat, lon: response.data.coord?.lon }
        });

        return response.data;
    } catch (error) {
        logger.error('🟡 BACKEND: OpenWeather API error', { error: error.message });
        throw error;
    }
}
```

---

## 3. ML SERVICE LOGGING (Python FastAPI)

### predict.py - ML Endpoint
```python
@router.post("/predict", response_model=PredictionResponse)
async def predict_single(request: PredictionRequest):
    print(f"🟣 ML-SERVICE: /predict endpoint called")
    print(f"  Timestamp: {datetime.now().isoformat()}")
    print(f"  Request body (raw): {request}")
    print(f"  Latitude: {request.latitude}")
    print(f"  Longitude: {request.longitude}")
    print(f"  Latitude type: {type(request.latitude)}")
    print(f"  Longitude type: {type(request.longitude)}")
    
    logger.info(f"ML Service: predict() called with coords [{request.latitude}, {request.longitude}]")
    
    try:
        result = model_inference(model, scaler, request.features, {
            'latitude': request.latitude,
            'longitude': request.longitude
        })
        
        logger.info(f"ML Service: Model returned probability={result['ml_probability']}, risk_level={result['risk_level']}")
        
        return PredictionResponse(
            latitude=request.latitude,
            longitude=request.longitude,
            ml_probability=result['ml_probability'],
            risk_level=result['risk_level'],
            confidence=result['confidence']
        )
    except Exception as e:
        logger.error(f"ML Service prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
```

---

## 4. VERIFICATION CHECKLIST

### Check Frontend Request
```javascript
// In browser DevTools:
// Open Network tab
// Send a prediction request
// Click on the POST /api/predictions request
// Check "Request" tab → JSON body
// Verify latitude and longitude values are DIFFERENT for each request
```

### Check Backend Request
```bash
# Terminal with backend logs
# Send request: curl -X POST http://localhost:8080/api/predictions \
#   -H "Content-Type: application/json" \
#   -H "Authorization: Bearer <token>" \
#   -d '{"latitude":16.5,  "longitude":73.85}'

# Look for:
# 🔵 BACKEND: predictionController.js - POST /api/predictions received
# - Check latitude and longitude values
```

### Check ML Service
```bash
# Terminal with ML service logs
# Restart with: python app/main.py
# Then send predictions from frontend
# Look for 🟣 ML-SERVICE logs with coordinates
```

---

## 5. COMMON ISSUES TO DETECT

### Issue 1: Same coordinates every time
**Symptom:** All requests log same lat/lon
**Likely cause:** Hardcoded coordinates in Redux state or component

**Search locations:**
- `grep -r "latitude.*longitude" client/src/` for hardcoded values
- Check Redux state initialization in `predictionsSlice.js`

### Issue 2: Coordinates sent but not received
**Symptom:** Frontend logs different values, backend logs same values
**Likely cause:** Request body modification in middleware or axios interceptor

**Check:**
```javascript
// predictionService.js - verify axios instance
// dashboardContent.jsx - verify dispatch parameters
```

### Issue 3: Cached API responses
**Symptom:** Different coordinates return same prediction object
**Likely cause:** Redis/cache returning stale result

**Check:**
```bash
# Check if elevation API results are cached wrong way:
grep -n "cache" server/src/services/elevationService.js
```

### Issue 4: Async loop broken
**Symptom:** Route analysis shows sampled coords but predictions are identical
**Likely cause:** Loop variable captured incorrectly in async callbacks

**Check RouteAnalysis.jsx:**
```javascript
// ❌ WRONG: Loop variable captured in closure
sampledCoords.map(coord => {
    axios.post(..., { latitude: coord.lat, longitude: coord.lng })
})

// ✅ CORRECT: Each iteration has its own scope
sampledCoords.forEach((coord, index) => {
    console.log(`Point ${index}:`, coord);
    axios.post(..., { latitude: coord.lat, longitude: coord.lng })
})
```

---

## 6. STEP-BY-STEP DEBUGGING

### Step 1: Test with hardcoded values
```javascript
// In Dashboard.jsx, temporarily hardcode test coordinates:
const testCoords = [
    { lat: 16.5, lon: 73.85 },  // Different locations
    { lat: 18.5, lon: 72.85 },
    { lat: 20.5, lon: 78.95 }
];

testCoords.forEach((coord, i) => {
    console.log(`Testing point ${i}:`, coord);
    dispatch(fetchSinglePrediction({ latitude: coord.lat, longitude: coord.lon }));
});
```

### Step 2: Monitor Network tab
- Send each request manually
- Verify Request body changes
- Compare Response objects

### Step 3: Check backend logs
```bash
# Look for coordinate differences in logs
# If all show same value, issue is frontend/middleware
# If backend receives correct, issue is in ML service
```

### Step 4: Check ML logs
```bash
# If ML logs show same coordinates
# Issue is either caching or request modification
```

---

## 7. QUICK DEBUG COMMANDS

```bash
# Terminal 1: Backend with verbose logging
cd server
npm run dev 2>&1 | grep -E "(BACKEND|getAPIData|getCurrentWeather)"

# Terminal 2: ML Service with verbose logging
cd ml-services/ml-service
python app/main.py 2>&1 | grep -E "(ML-SERVICE|predict)"

# Terminal 3: Frontend dev server
cd client
npm run dev

# Terminal 4: Test script
curl -X POST http://localhost:8080/api/predictions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"latitude":16.5,"longitude":73.85}' | jq .

# Change coordinates each time and compare responses
```

---

## 8. FINAL VALIDATION

After adding logging, perform this test:

```javascript
// Send 3 predictions with CLEARLY different coordinates
const testLocations = [
    { lat: 10, lon: 70 },    // South
    { lat: 20, lon: 80 },    // Central
    { lat: 30, lon: 90 }     // North
];

for (const loc of testLocations) {
    console.log(`Sending: [${loc.lat}, ${loc.lon}]`);
    await predictionService.getPrediction(loc.lat, loc.lon);
    // Wait 2 seconds between requests
    await new Promise(r => setTimeout(r, 2000));
}
```

**Expected:** Each response should have different probability/confidence values
**If all identical:** Issue is in coordinate handling (check logs to narrow down layer)
