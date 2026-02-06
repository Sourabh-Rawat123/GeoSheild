/**
 * ML Prediction Test Script
 * 
 * Tests the ML prediction system with various scenarios:
 * 1. High-risk location (Darjeeling, West Bengal)
 * 2. Moderate-risk location (Dehradun, Uttarakhand)
 * 3. Low-risk location (Bangalore, Karnataka)
 * 
 * Usage: node test-ml-prediction.js
 */

const integratedMLService = require('./src/services/integratedMLService');

const testLocations = [
    {
        name: 'Darjeeling, West Bengal (HIGH RISK)',
        lat: 27.0410,
        lon: 88.2636,
        expected: 'HIGH/CRITICAL'
    },
    {
        name: 'Dehradun, Uttarakhand (MODERATE RISK)',
        lat: 30.3165,
        lon: 78.0322,
        expected: 'MODERATE/HIGH'
    },
    {
        name: 'Bangalore, Karnataka (LOW RISK)',
        lat: 12.9716,
        lon: 77.5946,
        expected: 'LOW/MODERATE'
    },
    {
        name: 'Shimla, Himachal Pradesh (HIGH RISK)',
        lat: 31.1048,
        lon: 77.1734,
        expected: 'HIGH'
    }
];

async function testPrediction(location) {
    console.log('\n' + '='.repeat(70));
    console.log(`Testing: ${location.name}`);
    console.log(`Coordinates: ${location.lat}, ${location.lon}`);
    console.log(`Expected Risk: ${location.expected}`);
    console.log('='.repeat(70));

    try {
        const result = await integratedMLService.predict(location.lat, location.lon);

        console.log('\n📊 PREDICTION RESULT:');
        console.log(`├─ Final Probability: ${(result.prediction.probability * 100).toFixed(2)}%`);
        console.log(`├─ Risk Level: ${result.prediction.riskLevel}`);
        console.log(`├─ Confidence: ${(result.prediction.confidence * 100).toFixed(2)}%`);

        if (result.prediction.mlScore !== undefined) {
            console.log(`├─ ML Score: ${(result.prediction.mlScore * 100).toFixed(2)}%`);
        }

        if (result.prediction.apiScore !== undefined) {
            console.log(`├─ API Score: ${(result.prediction.apiScore * 100).toFixed(2)}%`);
        }

        if (result.prediction.historicalScore !== undefined) {
            console.log(`├─ Historical Score: ${(result.prediction.historicalScore * 100).toFixed(2)}%`);
        }

        console.log('\n🏛️ DISTRICT INFO:');
        if (result.prediction.districtInfo) {
            console.log(`├─ District: ${result.prediction.districtInfo.district_name || 'Unknown'}`);
            console.log(`├─ State: ${result.prediction.districtInfo.state_name || 'Unknown'}`);
            console.log(`├─ Risk Rank: ${result.prediction.districtInfo.district_rank || 'N/A'} / 72`);
            console.log(`├─ Risk Multiplier: ${result.prediction.districtInfo.risk_multiplier?.toFixed(2) || 'N/A'}x`);
        } else {
            console.log('└─ No district information available');
        }

        console.log('\n🌦️ WEATHER DATA:');
        if (result.weather) {
            console.log(`├─ Temperature: ${result.weather.temperature}°C`);
            console.log(`├─ Humidity: ${result.weather.humidity}%`);
            console.log(`├─ Rainfall (24h): ${result.weather.rainfall || 0}mm`);
            console.log(`├─ Wind Speed: ${result.weather.windSpeed || 0}m/s`);
        }

        console.log('\n🗻 TERRAIN DATA:');
        if (result.terrain) {
            console.log(`├─ Elevation: ${result.terrain.elevation}m`);
            console.log(`├─ Slope: ${result.terrain.slope?.toFixed(2) || 0}°`);
        }

        // Verify if result matches expected
        const actualRisk = result.prediction.riskLevel;
        const isExpected = location.expected.includes(actualRisk);

        console.log('\n✅ TEST STATUS:', isExpected ? '✓ PASSED' : '⚠ UNEXPECTED');

        return {
            location: location.name,
            success: true,
            expected: location.expected,
            actual: actualRisk,
            passed: isExpected,
            probability: result.prediction.probability
        };

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('Stack:', error.stack);

        return {
            location: location.name,
            success: false,
            error: error.message
        };
    }
}

async function runAllTests() {
    console.log('\n🧪 ML PREDICTION SYSTEM TEST');
    console.log('Testing prediction accuracy with known locations...\n');

    const results = [];

    for (const location of testLocations) {
        const result = await testPrediction(location);
        results.push(result);

        // Wait 2 seconds between tests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 TEST SUMMARY');
    console.log('='.repeat(70));

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    results.forEach(r => {
        if (r.success) {
            const status = r.passed ? '✓' : '⚠';
            console.log(`${status} ${r.location}: ${r.actual} (expected: ${r.expected}) - ${(r.probability * 100).toFixed(1)}%`);
        } else {
            console.log(`❌ ${r.location}: ERROR - ${r.error}`);
        }
    });

    console.log(`\n📊 Results: ${passed}/${total} tests matched expectations`);
    console.log('='.repeat(70));
}

// Run tests
runAllTests().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
