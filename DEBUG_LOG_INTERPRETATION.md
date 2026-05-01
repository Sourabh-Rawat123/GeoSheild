# COORDINATE FLOW DEBUG - LOG INTERPRETATION GUIDE

## Color-Coded Log System

Added strategic logging with color indicators to trace coordinates through the entire stack:

| Color | Layer | Component | Prefix |
|-------|-------|-----------|--------|
| 🟢 | Frontend (React) | Dashboard, RouteAnalysis | `🟢 FRONTEND` |
| 🔵 | Backend Controller | predictionController.js | `🔵 BACKEND` |
| 🟠 | Backend Orchestrator | integratedMLService.js | `🟠 ML SERVICE ORCHESTRATOR` |
| 🟡 | Backend APIs | weatherService.js, elevationService.js | `🟡 (service name)` |
| 🟣 | ML Service | Python FastAPI | `🟣 ML-SERVICE` |

---

## Expected Log Flow for a Correct Request

### Request: `GET /api/predictions?lat=16.5&lon=73.85` (Mumbai)

### ✅ CORRECT OUTPUT (Different coordinates = Different results)

#### Frontend Logs (Browser DevTools Console)
```
🟢 ========== FRONTEND DASHBOARD ==========
🟢 useEffect triggered - User location changed
🟢 Timestamp: 2026-04-30T10:15:23.456Z
🟢 user.location: {type: 'Point', coordinates: [73.85, 16.5], ...}
🟢 ✓ Valid coordinates extracted
🟢   Latitude: 16.5 (type: number)
🟢   Longitude: 73.85 (type: number)
🟢   Raw array: [73.85, 16.5]
🟢 ✓ Coordinates are valid, dispatching fetchSinglePrediction
🟢 Dispatch params: { latitude: 16.5, longitude: 73.85 }
```

#### Backend Controller Logs (Terminal with `npm run dev`)
```
🔵 ========== BACKEND CONTROLLER ==========
🔵 POST /api/predictions endpoint
🔵 Timestamp: 2026-04-30T10:15:23.500Z
🔵 User ID: 507f1f77bcf86cd799439011
🔵 Raw request.body: {"latitude":16.5,"longitude":73.85}
🔵 Extracted latitude: 16.5 (type: number)
🔵 Extracted longitude: 73.85 (type: number)
🔵 Valid number check - isFinite(lat): true, isFinite(lon): true
🔵 Range check - lat in [-90,90]: true, lon in [-180,180]: true
🔵 Calling integratedMLService.predict(16.5, 73.85)
```

#### ML Service Orchestrator Logs
```
🟠 ========== ML SERVICE ORCHESTRATOR ==========
🟠 predict() called with coordinates
🟠 Timestamp: 2026-04-30T10:15:23.510Z
🟠 Latitude: 16.5 (type: number)
🟠 Longitude: 73.85 (type: number)
🟠 Hash of coordinates: {"latitude":16.5,"longitude":73.85}
🟠 Calling getAPIData(16.5, 73.85)
🟠 getAPIData returned: {
    elevation: 742,
    rainfall24h: 0,
    earthquakeCount: 0
  }
```

#### Weather Service Logs
```
🟡 weatherService.getCurrentWeather() called
🟡   Latitude: 16.5 (type: number)
🟡   Longitude: 73.85 (type: number)
🟡 OpenWeather API response for [16.5, 73.85]: {
    temp: 27.5,
    apiLat: 16.5,
    apiLon: 73.85
  }
```

#### Elevation Service Logs
```
🟡 elevationService.getElevationData() called
🟡   Latitude: 16.5
🟡   Longitude: 73.85
🟡   Cache key: 16.5_73.85_4
🟡 ✗ Cache MISS - calling elevation API
🟡 Elevation data cached for 16.5_73.85_4: elevation=742, slope=5.23°
```

---

### ❌ PROBLEMATIC OUTPUTS (Same coordinates = Same prediction)

#### Problem 1: Same Coordinates Logged Everywhere

```
Request 1:
🟢 Dispatch params: { latitude: 16.5, longitude: 73.85 }
🔵 Extracted latitude: 16.5 (type: number)
🔵 Extracted longitude: 73.85 (type: number)
🟠 Latitude: 16.5, Longitude: 73.85

Request 2:
🟢 Dispatch params: { latitude: 16.5, longitude: 73.85 }  ❌ SAME AS REQUEST 1
🔵 Extracted latitude: 16.5 (type: number)              ❌ SAME AS REQUEST 1
🔵 Extracted longitude: 73.85 (type: number)            ❌ SAME AS REQUEST 1
🟠 Latitude: 16.5, Longitude: 73.85                     ❌ SAME AS REQUEST 1
```

**Diagnosis:**
- Frontend is storing hardcoded coordinates in Redux state
- Check: `Dashboard.jsx` or `predictionsSlice.js` for hardcoded values
- **Fix:** Verify that user.location.coordinates updates when setLocation() is called

---

#### Problem 2: Frontend Different, Backend Same

```
Request 1 Frontend:
🟢 Dispatch params: { latitude: 16.5, longitude: 73.85 }

Request 2 Frontend:
🟢 Dispatch params: { latitude: 21.1, longitude: 79.1 }   ✓ DIFFERENT

But Backend Shows:
Request 1:
🔵 Extracted latitude: 16.5
🔵 Extracted longitude: 73.85

Request 2:
🔵 Extracted latitude: 16.5  ❌ SHOULD BE 21.1
🔵 Extracted longitude: 73.85 ❌ SHOULD BE 79.1
```

**Diagnosis:**
- Request body being overwritten in middleware or axios interceptor
- Check: `predictionService.js` axios instance
- Check: Middleware in `app.js` or `authMiddleware`
- **Fix:** Verify axios POST is not modifying the request body

---

#### Problem 3: Elevation Cache Returning Same Data

```
Request 1:
🟡 elevationService.getElevationData() called
🟡   Latitude: 16.5
🟡   Longitude: 73.85
🟡 ✓ Cache HIT - returning cached elevation: 742

Request 2:
🟡 elevationService.getElevationData() called
🟡   Latitude: 21.1
🟡   Longitude: 79.1
🟡 ✗ Cache MISS - calling elevation API  ✓ Correct

BUT Output Shows:
Request 2 Returns: elevation = 742  ❌ SHOULD BE DIFFERENT
```

**Diagnosis:**
- Cache key generation is not precise enough
- Check: `getCacheKey()` function in `elevationService.js`
- Current precision is 4 decimal places (~11m accuracy)
- **Fix:** Increase precision to 5 decimal places (~1m accuracy):
```javascript
getCacheKey(lat, lon, precision = 5) {  // Changed from 4 to 5
    return `${lat.toFixed(precision)}_${lon.toFixed(precision)}`;
}
```

---

#### Problem 4: All APIs Called But Result Same

```
Request 1:
🟠 Calling getAPIData(16.5, 73.85)
🟡 weatherService.getCurrentWeather() called with [16.5, 73.85]
🟡 Elevation data cached for 16.5_73.85_4: elevation=742
🟡 OpenWeather API response: temp=27.5

Request 2:
🟠 Calling getAPIData(21.1, 79.1)
🟡 weatherService.getCurrentWeather() called with [21.1, 79.1]
🟡 ✓ Cache HIT - returning cached elevation: 742  ❌ Wrong elevation!
🟡 OpenWeather API response: temp=28.2
```

**Diagnosis:**
- Different weather data but same elevation (cache was cached from request 1)
- Cache key is too broad - rounding similar locations to same key
- **Fix:** Use more precise cache key or clear cache between test requests

---

## Step-by-Step Debugging Process

### Step 1: Run One Request and Check Frontend Logs

**Action:** Open DevTools (F12) → Console, send one prediction

**What to look for:**
```
🟢 Dispatch params: { latitude: 16.5, longitude: 73.85 }
```

**If this line missing or shows wrong values:**
- Issue is in Dashboard.jsx or RouteAnalysis.jsx
- Check that user.location is being set correctly
- Verify coordinates aren't hardcoded

---

### Step 2: Check Backend Controller Logs

**Action:** Look at backend terminal while request is being sent

**What to look for:**
```
🔵 Extracted latitude: 16.5 (type: number)
🔵 Extracted longitude: 73.85 (type: number)
```

**If this shows DIFFERENT values than frontend:**
- Problem is in axios interceptor or middleware
- Search for coordinate modification code
- Check `predictionService.js` for request body modification

---

### Step 3: Check ML Orchestrator Logs

**Action:** Still in backend terminal, look for 🟠 logs

**What to look for:**
```
🟠 Latitude: 16.5, Longitude: 73.85
```

**If this matches backend controller:**
- Coordinates are being passed correctly to ML service
- Problem is downstream (API calls or caching)

---

### Step 4: Check API Call Logs

**Action:** Look for 🟡 logs from weatherService and elevationService

**What to look for - Weather Service:**
```
🟡 weatherService.getCurrentWeather() called
🟡   Latitude: 16.5
🟡   Longitude: 73.85
🟡 OpenWeather API response for [16.5, 73.85]: { temp: 27.5, ... }
```

**If weather data is same for different coordinates:**
- OpenWeather API might be returning cached data
- Or coordinates aren't being passed to API
- Check the `params` object in axios.get() call

**What to look for - Elevation Service:**
```
🟡 elevationService.getElevationData() called
🟡   Cache key: 16.5_73.85_4
🟡 ✗ Cache MISS - calling elevation API
```

**If seeing "Cache HIT" for different coordinates:**
- Cache precision is too low
- Increase precision from 4 to 5 decimal places

---

## Quick Diagnostic Flowchart

```
Same predictions for different coordinates?
│
├─ YES, same logs everywhere
│  └─ PROBLEM: Hardcoded coordinates
│     ACTION: Search for latitude/longitude in Dashboard.jsx
│
├─ Frontend different, backend same
│  └─ PROBLEM: Request body modification
│     ACTION: Check axios interceptor in predictionService.js
│
├─ Backend different, but same weather response
│  └─ PROBLEM: Elevation cache too broad
│     ACTION: Increase cache precision from 4 to 5
│
└─ All different but same final prediction
   └─ PROBLEM: API response doesn't vary by location
      ACTION: Verify OpenWeather returns different temps
```

---

## Commands to Filter Logs

### Terminal 1: Backend logs only
```bash
# Watch all colored logs
cd server && npm run dev 2>&1 | grep -E '(🔵|🟠|🟡)'

# Only controller logs
cd server && npm run dev 2>&1 | grep '🔵'

# Only cache hits/misses
cd server && npm run dev 2>&1 | grep -i 'cache'

# Only elevation service
cd server && npm run dev 2>&1 | grep 'elevation'
```

### Browser: Frontend logs only
```javascript
// In DevTools Console:
copy(document.body.innerText.match(/🟢.*/g).join('\n'))
// Then paste in text editor
```

---

## Expected Behavior After Fix

When you send 3 predictions with coordinates:
- **16.5, 73.85** (Mumbai)
- **21.1, 79.1** (Nagpur)  
- **18.5, 73.9** (Pune)

You should see **3 DIFFERENT results**:

| Location | Risk Level | Probability |
|----------|------------|-------------|
| Mumbai (16.5, 73.85) | LOW | 18% |
| Nagpur (21.1, 79.1) | MODERATE | 45% |
| Pune (18.5, 73.9) | MODERATE | 42% |

**If all show same probability (e.g., all 16.3%):**
- One of the issues above is present
- Use this guide to narrow it down
