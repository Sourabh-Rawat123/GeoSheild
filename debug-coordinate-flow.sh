#!/bin/bash
# DEBUG_COORDINATE_FLOW.sh
# Quick start script to capture coordinate flow through the system

echo "============================================"
echo "COORDINATE FLOW DEBUGGING - QUICK START"
echo "============================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Check backend is running...${NC}"
curl -s http://localhost:8080/health || (
    echo -e "${RED}❌ Backend not running!${NC}"
    echo "Start it with: cd server && npm run dev"
    exit 1
)
echo -e "${GREEN}✓ Backend is running${NC}"
echo ""

echo -e "${BLUE}Step 2: Check ML service is running...${NC}"
curl -s http://localhost:8001/health || (
    echo -e "${RED}❌ ML service not running!${NC}"
    echo "Start it with: cd ml-services/ml-service && python app/main.py"
    exit 1
)
echo -e "${GREEN}✓ ML service is running${NC}"
echo ""

echo -e "${BLUE}Step 3: Get your auth token...${NC}"
read -p "Enter your email (e.g., user@test.com): " EMAIL
read -sp "Enter your password: " PASSWORD
echo ""

echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Login failed!${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Login successful${NC}"
echo "Token: ${TOKEN:0:20}..."
echo ""

echo -e "${BLUE}Step 4: Test coordinate flow with 3 different locations...${NC}"
echo ""

# Test locations with VERY different coordinates
LOCATIONS=(
    "16.5,73.85:Mumbai"
    "21.1458,79.0882:Nagpur"
    "18.5204,73.8567:Pune"
)

for LOC in "${LOCATIONS[@]}"; do
    COORDS="${LOC%:*}"
    NAME="${LOC#*:}"
    LAT="${COORDS%,*}"
    LON="${COORDS#*,}"
    
    echo -e "${YELLOW}Testing: ${NAME} (${LAT}, ${LON})${NC}"
    echo "Command:"
    echo "  curl -X POST http://localhost:8080/api/predictions \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -H \"Authorization: Bearer ${TOKEN:0:20}...\" \\"
    echo "    -d '{\"latitude\":${LAT},\"longitude\":${LON}}'"
    echo ""
    
    RESPONSE=$(curl -s -X POST http://localhost:8080/api/predictions \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"latitude\":${LAT},\"longitude\":${LON}}")
    
    RISK=$(echo $RESPONSE | grep -o '"riskLevel":"[^"]*' | cut -d'"' -f4)
    PROB=$(echo $RESPONSE | grep -o '"probability":[0-9.]*' | cut -d':' -f2)
    CONF=$(echo $RESPONSE | grep -o '"confidence":[0-9.]*' | cut -d':' -f2)
    
    echo "Response:"
    echo "  Risk Level: $RISK"
    echo "  Probability: $(echo "scale=1; $PROB * 100" | bc)%"
    echo "  Confidence: $CONF"
    echo "  Full response: $RESPONSE"
    echo ""
    
    sleep 2  # 2 second delay between requests
done

echo -e "${BLUE}Step 5: Check the logs...${NC}"
echo ""
echo "In SEPARATE terminal windows, check these logs:"
echo ""
echo "1. BACKEND LOGS (shows 🔵, 🟠, 🟡 prefixes):"
echo "   Terminal: tail -f server/logs/app.log | grep -E '(🔵|🟠|🟡|DEBUG)'"
echo ""
echo "2. FRONTEND LOGS (shows 🟢 prefix):"
echo "   Browser DevTools: F12 → Console tab"
echo "   Filter: 🟢"
echo ""
echo "3. ML SERVICE LOGS (shows 🟣 prefix):"
echo "   Terminal: Terminal output from python app/main.py"
echo ""
echo "============================================"
echo "Debugging tips:"
echo "============================================"
echo "1. If all 3 locations return SAME risk level:"
echo "   → Coordinate caching issue OR hardcoded coordinates"
echo "   → Check backend logs for 'Cache HIT' messages"
echo ""
echo "2. If frontend sends different coords but backend logs same:"
echo "   → Issue in middleware or axios interceptor"
echo "   → Check 🔵 BACKEND CONTROLLER logs"
echo ""
echo "3. If backend receives correct coords but ML returns same result:"
echo "   → Issue in integratedMLService.predict()"
echo "   → Check 🟠 ML SERVICE ORCHESTRATOR logs"
echo ""
echo "4. If all logs show different coords but predictions identical:"
echo "   → Issue in ML model or API scoring"
echo "   → Check 🟡 weatherService logs for API response variations"
echo ""
