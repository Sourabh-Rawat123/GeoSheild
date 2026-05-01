# QUICK REFERENCE - Coordinate Debugging

## 🚀 Start Debugging in 3 Steps

### Step 1: Start Services
```bash
Terminal 1: cd server && npm run dev
Terminal 2: cd ml-services/ml-service && python app/main.py  
Terminal 3: cd client && npm run dev
```

### Step 2: Open DevTools
```
Press F12 in browser
Click "Console" tab
```

### Step 3: Send Prediction
```
Dashboard: Click "Use Current Location" or enter manual coordinates
RouteAnalysis: Enter start and destination, click "Analyze Route"
```

---

## 📊 What to Look For

| Layer | Terminal | Prefix | What You'll See |
|-------|----------|--------|-----------------|
| **Frontend** | Browser DevTools | 🟢 | Coordinates being dispatched |
| **Backend Controller** | `npm run dev` | 🔵 | Request body received |
| **ML Orchestrator** | `npm run dev` | 🟠 | Coordinates passed to ML |
| **Weather API** | `npm run dev` | 🟡 | API calls with coordinates |
| **Elevation Cache** | `npm run dev` | 🟡 | Cache hits/misses |

---

## ✅ CORRECT BEHAVIOR (3 Locations → 3 Different Results)

```
🟢 Request 1: latitude: 16.5, longitude: 73.85 → Risk: 18%
🟢 Request 2: latitude: 21.1, longitude: 79.1  → Risk: 45%  ← DIFFERENT
🟢 Request 3: latitude: 18.5, longitude: 73.9  → Risk: 42%  ← DIFFERENT
```

---

## ❌ BUG INDICATORS

### Bug: All Same Risk Level (e.g., all 16.3%)
```
Check: Are coordinates the same everywhere?
  🟢 Frontend shows different coordinates ✓
  🔵 Backend receives different coordinates ✓
  But 🟡 elevation cache HIT for all three? ✗ BUG!
  
Fix: Increase cache precision
  // In elevationService.js line ~40
  getCacheKey(lat, lon, precision = 4)  // Change to 5
```

### Bug: Frontend Different, Backend Same
```
Check: 
  🟢 Frontend: latitude: 21.1 ✓
  🔵 Backend: latitude: 16.5 ✗ WRONG!
  
Fix: Check axios interceptor
  // In predictionService.js
  // Make sure POST body isn't being modified
```

### Bug: All APIs Return Same Data
```
Check:
  🟡 OpenWeather temp=27.5 for different locations ✗
  🟡 Elevation cache hit for different coords ✗
  
Fix: Verify cache key uniqueness or API response differences
```

---

## 🔍 Commands to Copy-Paste

### Filter Backend Logs
```bash
# Only colored logs
npm run dev 2>&1 | grep -E '(🔵|🟠|🟡)'

# Only cache messages  
npm run dev 2>&1 | grep -i cache

# Only elevation service
npm run dev 2>&1 | grep elevation

# Follow logs in real-time
tail -f server/logs/app.log | grep -E '(🔵|🟠|🟡)'
```

### Browser Console (DevTools)
```javascript
// Copy this to filter frontend logs
copy(
  Array.from(
    document.querySelectorAll('div.console-message')
  ).filter(el => el.textContent.includes('🟢'))
    .map(el => el.textContent)
    .join('\n')
)
```

### Test with cURL
```bash
# Get token first
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"admin123"}' | jq .token

# Test prediction (replace TOKEN)
curl -X POST http://localhost:8080/api/predictions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"latitude":16.5,"longitude":73.85}'
```

---

## 📋 Checklist

- [ ] All services started (backend, ML, frontend)
- [ ] DevTools Console shows 🟢 logs
- [ ] Backend terminal shows 🔵 logs
- [ ] Compared 3 different coordinates
- [ ] Verified coordinates flow through all layers
- [ ] Identified which layer breaks the flow
- [ ] Applied fix from DEBUG_COORDINATE_FLOW.md
- [ ] Tested again with 3 different locations
- [ ] Got 3 different prediction results ✓

---

## 🐛 Most Common Issues

### 1. **Same elevation for different locations**
   - **Root Cause:** Cache key too broad (rounding 4 decimals)
   - **Fix:** Change precision from 4 to 5 in `elevationService.js` line 40

### 2. **Frontend sends different, backend receives same**
   - **Root Cause:** Request body modified by axios interceptor
   - **Fix:** Check `predictionService.js` for config that modifies request

### 3. **All coordinates logged correctly but same prediction**
   - **Root Cause:** API response doesn't vary (using same hardcoded mock data)
   - **Fix:** Check if APIs are returning real or mock data

### 4. **Frontend shows same coordinates for manual input**
   - **Root Cause:** User.location not updating after setLocation()
   - **Fix:** Check Redux dispatch and state update in Dashboard.jsx

---

## 💡 Pro Tips

1. **Sort logs by time:** Each log has timestamp - compare milliseconds
2. **Follow one request:** Mark the timestamp, follow through all logs
3. **Use grep patterns:** `grep "latitude: 16.5"` to find related logs
4. **Test systematically:** 
   - First: 1 location twice (should give same result)
   - Then: 2 locations far apart (should give different results)
   - Finally: 3 locations (should all be different)

5. **Clear cache between tests:**
   ```javascript
   // In Node terminal:
   const elevationService = require('./server/src/services/elevationService');
   elevationService.clearCache();
   ```

---

## 📞 When Stuck

If logs all look correct but predictions still same:

1. Check if ML model itself varies by input (not the issue)
2. Check if weather API returns same temperature for different coords
3. Check if earthquake API returns same data
4. Check integratedMLService `calculateAPIScore()` - maybe all locations score same

**Run script to validate:**
```javascript
// In browser console
fetch('http://localhost:8080/api/predictions', {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer TOKEN'},
  body: JSON.stringify({latitude: 16.5, longitude: 73.85})
}).then(r => r.json()).then(d => console.log('Score 1:', d))

fetch('http://localhost:8080/api/predictions', {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer TOKEN'},
  body: JSON.stringify({latitude: 21.1, longitude: 79.1})
}).then(r => r.json()).then(d => console.log('Score 2:', d))
```

Compare the two responses - all fields should differ.
