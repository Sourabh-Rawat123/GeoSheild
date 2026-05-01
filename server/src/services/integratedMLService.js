/**
 * Integrated ML Service
 * Combines API data (50%) + ML predictions (40%) + Historical CSV data (10%)
 * ML runs via FastAPI ml-service on port 8001 (NOT in-process Python)
 */

const weatherService = require('./weatherService');
const mlServiceClient = require('./mlServiceClient');
const logger = require('../utils/logger');

class IntegratedMLService {
    constructor() {
        // Weights for combining predictions (must sum to 1.0)
        this.weights = {
            api: parseFloat(process.env.API_WEIGHT || '0.50'),
            ml: parseFloat(process.env.ML_WEIGHT || '0.40'),
            historical: parseFloat(process.env.HISTORICAL_WEIGHT || '0.10')
        };

        // Validate weights
        const sum = this.weights.api + this.weights.ml + this.weights.historical;
        if (Math.abs(sum - 1.0) > 0.01) {
            logger.warn(`Prediction weights sum to ${sum}, normalizing to 1.0`);
            this.weights.api /= sum;
            this.weights.ml /= sum;
            this.weights.historical /= sum;
        }

        logger.info('IntegratedMLService initialized with ml-service', { weights: this.weights });
    }

    /**
     * Main prediction method - combines all sources
     */
    async predict(latitude, longitude) {
        try {
            // === DEBUG: Log prediction start ===
            console.log('\n🟠 ========== ML SERVICE ORCHESTRATOR ==========');
            console.log(`🟠 predict() called with coordinates`);
            console.log(`🟠 Timestamp: ${new Date().toISOString()}`);
            console.log(`🟠 Latitude: ${latitude} (type: ${typeof latitude})`);
            console.log(`🟠 Longitude: ${longitude} (type: ${typeof longitude})`);
            console.log(`🟠 Hash of coordinates: ${JSON.stringify({ latitude, longitude })}`);
            // ========================================

            logger.info('Starting integrated prediction', { latitude, longitude });

            // Step 1: Get API data (50% weight)
            console.log(`🟠 Calling getAPIData(${latitude}, ${longitude})`);
            const apiData = await this.getAPIData(latitude, longitude);
            console.log(`🟠 getAPIData returned:`, {
                elevation: apiData.terrain.elevation,
                rainfall24h: apiData.weather.rainfall24h,
                earthquakeCount: apiData.seismic.count
            });
            const apiScore = this.calculateAPIScore(apiData);

            // Step 2: Prepare features for ML
            const features = this.buildFeatures(apiData, latitude, longitude);

            // Step 3: Call Python ML script (40% + 10% weights)
            const mlData = await this.runMLPrediction(latitude, longitude, features);

            // Validate ML data structure
            if (!mlData || typeof mlData !== 'object') {
                throw new Error(`ML prediction returned invalid data type: ${typeof mlData}`);
            }

            if (!mlData.success) {
                throw new Error(mlData.error || 'ML prediction failed');
            }

            if (!mlData.ml_result || typeof mlData.ml_result !== 'object') {
                throw new Error(`ML result missing or invalid: ${JSON.stringify(mlData)}`);
            }

            if (typeof mlData.ml_result.ml_probability !== 'number') {
                throw new Error(`ML probability missing or invalid: ${mlData.ml_result.ml_probability}`);
            }

            // Step 4: Combine all sources with weights
            const finalRisk = this.combineScores(
                apiScore,
                mlData.ml_result.ml_probability,
                mlData.historical_score || 0
            );

            // Step 5: Determine overall risk level and confidence
            const riskLevel = this.getRiskLevel(finalRisk);
            const confidence = this.calculateOverallConfidence(apiData, mlData);

            const result = {
                success: true,
                prediction: {
                    riskLevel,
                    probability: finalRisk,
                    confidence,
                    coordinates: { latitude, longitude }
                },
                breakdown: {
                    api: {
                        score: apiScore,
                        weight: this.weights.api,
                        contribution: apiScore * this.weights.api,
                        data: {
                            temperature: apiData.weather.temperature,
                            humidity: apiData.weather.humidity,
                            rainfall24h: apiData.weather.rainfall24h,
                            rainfall72h: apiData.weather.rainfall72h,
                            earthquakeCount: apiData.seismic.count,
                            maxMagnitude: apiData.seismic.maxMagnitude
                        }
                    },
                    ml: {
                        score: mlData.ml_result.ml_probability,
                        weight: this.weights.ml,
                        contribution: mlData.ml_result.ml_probability * this.weights.ml,
                        riskLevel: mlData.ml_result.risk_level,
                        confidence: mlData.ml_result.confidence
                    },
                    historical: {
                        score: mlData.historical_score,
                        weight: this.weights.historical,
                        contribution: mlData.historical_score * this.weights.historical,
                        source: 'CSV historical events data'
                    }
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    weights: this.weights,
                    sources: ['OpenWeatherMap API', 'USGS Earthquake API', 'Open Elevation API', 'ML Model', 'Historical CSV']
                }
            };

            logger.info('Prediction completed', { riskLevel, probability: finalRisk });
            return result;

        } catch (error) {
            logger.error('Integrated prediction failed', { error: error.message, latitude, longitude });
            throw error;
        }
    }

    /**
     * Fetch data from external APIs (50% weight source)
     */
    async getAPIData(latitude, longitude) {
        try {
            // === DEBUG: Log API data fetch ===
            console.log(`🟠 getAPIData() called`);
            console.log(`🟠   Latitude: ${latitude}`);
            console.log(`🟠   Longitude: ${longitude}`);
            // ===================================

            const [weatherResponse, seismicResponse, elevationResponse] = await Promise.all([
                weatherService.getCurrentWeather(latitude, longitude),
                weatherService.getEarthquakeData(latitude, longitude, 100),
                weatherService.getElevationData(latitude, longitude)
            ]);

            // 1. Log raw API responses
            console.log("RAW WEATHER API:", JSON.stringify(weatherResponse, null, 2));
            console.log("RAW EARTHQUAKE API:", JSON.stringify(seismicResponse, null, 2));
            console.log("RAW ELEVATION API:", JSON.stringify(elevationResponse, null, 2));

            // 2. Validate API responses - weatherService already extracts data, so check for temperature directly
            if (!weatherResponse || typeof weatherResponse.temperature !== 'number') {
                console.warn('⚠️ Weather API response missing temperature field');
                throw new Error('Weather API response is invalid or empty');
            }
            if (!seismicResponse || typeof seismicResponse.count !== 'number') {
                console.warn('⚠️ Earthquake API response missing count field');
                throw new Error('Earthquake API response is invalid or empty');
            }
            if (!elevationResponse || typeof elevationResponse.elevation !== 'number') {
                console.warn('⚠️ Elevation API response missing elevation field');
                throw new Error('Elevation API response is invalid or empty');
            }

            // 3. Extract real values safely from already-processed API responses
            const temperature = weatherResponse.temperature;
            const humidity = weatherResponse.humidity;
            const pressure = weatherResponse.pressure;
            const windSpeed = weatherResponse.windSpeed;
            const rainfall24h = weatherResponse.rainfall || 0;
            const rainfall72h = weatherResponse.rainfall72h || 0;

            const earthquakeCount = seismicResponse.count;
            const maxMagnitude = seismicResponse.maxMagnitude;
            const avgMagnitude = seismicResponse.avgMagnitude;

            const elevation = elevationResponse.elevation;
            const slope = elevationResponse.slope_degrees || 0; // Note: field name is slope_degrees

            // 4. Add debug logs AFTER extraction
            console.log("EXTRACTED DATA:", { temperature, humidity, pressure, windSpeed, rainfall24h, rainfall72h, earthquakeCount, maxMagnitude, elevation, slope });

            // 5. Validate that critical fields are real numbers (not defaults)
            if (!Number.isFinite(temperature) || !Number.isFinite(humidity) || !Number.isFinite(elevation)) {
                throw new Error('Extracted data contains invalid numbers');
            }

            // 6. If using fallback values, log warning
            if (rainfall24h === 0 && maxMagnitude === 0) {
                logger.warn("⚠ Rainfall and earthquake data are both zero, may be using defaults");
            }

            console.log(`🟠 All APIs called successfully. Returning data for [${latitude}, ${longitude}]`);

            return {
                weather: {
                    temperature: temperature,
                    humidity: humidity,
                    pressure: pressure,
                    windSpeed: windSpeed,
                    rainfall24h: rainfall24h,
                    rainfall72h: rainfall72h
                },
                seismic: {
                    count: earthquakeCount,
                    maxMagnitude: maxMagnitude,
                    avgMagnitude: avgMagnitude
                },
                terrain: {
                    elevation: elevation,
                    slope: slope
                }
            };
        } catch (error) {
            console.error(`🟠 API data fetch failed:`, error.message);
            logger.error(`API data fetch failed: ${error.message}`);
            // Return default values if APIs fail
            return {
                weather: { temperature: 25, humidity: 50, pressure: 1013, windSpeed: 0, rainfall24h: 0, rainfall72h: 0 },
                seismic: { count: 0, maxMagnitude: 0, avgMagnitude: 0 },
                terrain: { elevation: 0, slope: 0 }
            };
        }
    }

    /**
     * Calculate risk score from API data (0-1)
     */
    /**
     * Calculate risk score from API data (weather, terrain, seismic)
     * Returns value 0.0 to 1.0 representing risk level
     */
    calculateAPIScore(apiData) {
        let score = 0;
        const factors = {}; // For detailed logging

        // 1. RAINFALL FACTOR (25% of API score) - Primary indicator
        const rainfall24h = apiData.weather.rainfall24h;
        const rainfall72h = apiData.weather.rainfall72h;
        const maxRainfall = Math.max(rainfall24h, rainfall72h);

        if (maxRainfall > 100) {
            factors.rainfall = 0.25; // Extreme rainfall (>100mm)
            score += 0.25;
        } else if (maxRainfall > 50) {
            factors.rainfall = 0.20; // Heavy rainfall (50-100mm)
            score += 0.20;
        } else if (maxRainfall > 25) {
            factors.rainfall = 0.15; // Moderate rainfall (25-50mm)
            score += 0.15;
        } else if (maxRainfall > 10) {
            factors.rainfall = 0.10; // Light rainfall (10-25mm)
            score += 0.10;
        } else {
            // Proportional for minimal rainfall
            factors.rainfall = (maxRainfall / 50) * 0.25;
            score += factors.rainfall;
        }

        // 2. TERRAIN/SLOPE FACTOR (25% of API score) - Critical for landslides
        const slope = apiData.terrain.slope;
        if (slope > 35) {
            factors.slope = 0.25; // Very steep (>35°)
            score += 0.25;
        } else if (slope > 25) {
            factors.slope = 0.20; // Steep (25-35°)
            score += 0.20;
        } else if (slope > 15) {
            factors.slope = 0.15; // Moderate (15-25°)
            score += 0.15;
        } else if (slope > 5) {
            factors.slope = 0.10; // Slight (5-15°)
            score += 0.10;
        } else {
            // Proportional for flat terrain
            factors.slope = (slope / 35) * 0.25;
            score += factors.slope;
        }

        // 3. ELEVATION FACTOR (15% of API score) - Higher elevation = steeper terrain
        const elevation = apiData.terrain.elevation;
        if (elevation > 2000) {
            factors.elevation = 0.15; // Very high elevation (>2000m)
            score += 0.15;
        } else if (elevation > 1500) {
            factors.elevation = 0.12; // High elevation (1500-2000m)
            score += 0.12;
        } else if (elevation > 1000) {
            factors.elevation = 0.10; // Medium elevation (1000-1500m)
            score += 0.10;
        } else if (elevation > 500) {
            factors.elevation = 0.08; // Low elevation (500-1000m)
            score += 0.08;
        } else if (elevation > 0) {
            factors.elevation = (elevation / 2000) * 0.15;
            score += factors.elevation;
        } else {
            factors.elevation = 0;
        }

        // 4. SEISMIC FACTOR (20% of API score) - Earthquakes trigger landslides
        const maxMagnitude = apiData.seismic.maxMagnitude;
        const earthquakeCount = apiData.seismic.count;

        if (maxMagnitude > 5.0) {
            factors.seismic = 0.20; // Major earthquake (>5.0 magnitude)
            score += 0.20;
        } else if (maxMagnitude > 4.0) {
            factors.seismic = 0.15; // Moderate earthquake (4.0-5.0)
            score += 0.15;
        } else if (maxMagnitude > 3.0) {
            factors.seismic = 0.10; // Minor earthquake (3.0-4.0)
            score += 0.10;
        } else if (earthquakeCount > 5) {
            // Multiple smaller earthquakes can destabilize terrain
            factors.seismic = Math.min(0.12, (earthquakeCount / 10) * 0.20);
            score += factors.seismic;
        } else {
            factors.seismic = (maxMagnitude / 30) * 0.20;
            score += factors.seismic;
        }

        // 5. HUMIDITY FACTOR (15% of API score) - Water saturation increases risk
        const humidity = apiData.weather.humidity;
        if (humidity > 90) {
            factors.humidity = 0.15; // Very wet (>90% humidity)
            score += 0.15;
        } else if (humidity > 75) {
            factors.humidity = 0.12; // Wet (75-90%)
            score += 0.12;
        } else if (humidity > 60) {
            factors.humidity = 0.08; // Moderate (60-75%)
            score += 0.08;
        } else if (humidity > 40) {
            factors.humidity = 0.04; // Dry (40-60%)
            score += 0.04;
        } else {
            factors.humidity = 0; // Very dry (<40%)
        }

        // Cap score at 1.0
        const finalScore = Math.min(score, 1.0);

        // Log factor breakdown for transparency
        console.log('🟠 calculateAPIScore() factor breakdown:');
        console.log(`   Rainfall (0-25%): ${(factors.rainfall * 100).toFixed(1)}%`);
        console.log(`   Slope (0-25%): ${(factors.slope * 100).toFixed(1)}%`);
        console.log(`   Elevation (0-15%): ${(factors.elevation * 100).toFixed(1)}%`);
        console.log(`   Seismic (0-20%): ${(factors.seismic * 100).toFixed(1)}%`);
        console.log(`   Humidity (0-15%): ${(factors.humidity * 100).toFixed(1)}%`);
        console.log(`   Total API Score: ${(finalScore * 100).toFixed(1)}%`);

        return finalScore;
    }

    /**
     * Build feature set for ML model
     */
    buildFeatures(apiData, latitude, longitude) {
        // IMPORTANT: Make sure we use the actual API data, not defaults
        const rainfall = apiData.weather.rainfall24h;
        const earthquakeMagnitude = apiData.seismic.maxMagnitude;
        const elevation = apiData.terrain.elevation;
        const slope = apiData.terrain.slope;

        console.log("🟠 buildFeatures() - Input validation:");
        console.log(`   temperature: ${apiData.weather.temperature} (expect ~25-30, not 25)`);
        console.log(`   rainfall: ${rainfall} (expect >=0)`);
        console.log(`   earthquake_magnitude: ${earthquakeMagnitude} (expect >=0)`);
        console.log(`   elevation: ${elevation} (expect >0, NOT a longitude like 73.xxx)`);
        console.log(`   slope: ${slope} (expect >0, NOT 0)`);

        const mlInput = {
            latitude,
            longitude,
            temperature: apiData.weather.temperature,
            humidity: apiData.weather.humidity,
            pressure: apiData.weather.pressure,
            wind_speed: apiData.weather.windSpeed,
            rainfall_24h: rainfall,
            rainfall_72h: apiData.weather.rainfall72h,
            elevation: elevation,
            slope: slope,
            earthquake_count: apiData.seismic.count,
            max_earthquake_magnitude: earthquakeMagnitude,
            soil_moisture: 0.5, // Default - can be enhanced
            ndvi: 0.5, // Default - can be enhanced
            distance_to_fault: 10.0, // Default - can be enhanced
            population_density: 100 // Default - can be enhanced
        };

        // 6. Log final ML payload with validation
        console.log("FINAL ML INPUT:", JSON.stringify(mlInput, null, 2));

        // Validate no values are using defaults when real data should be present
        if (elevation === 0) {
            console.warn("⚠️ WARNING: elevation is 0! This means elevation API data was not used");
        }
        if (slope === 0) {
            console.warn("⚠️ WARNING: slope is 0! This could mean terrain is flat or data not loaded");
        }
        if (rainfall === 0 && earthquakeMagnitude === 0) {
            console.warn("⚠️ WARNING: Both rainfall and earthquake are 0! May be using all defaults");
        }

        return mlInput;
    }

    /**
     * Run ML prediction using ml-service REST API
     */
    async runMLPrediction(latitude, longitude, features) {
        try {
            // Call ml-service via REST API instead of subprocess
            const mlResult = await mlServiceClient.predictSingle(latitude, longitude, features);
            return mlResult;
        } catch (error) {
            logger.error('ML Service prediction failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Combine scores from all sources with weights
     */
    combineScores(apiScore, mlScore, historicalScore) {
        const weighted =
            (apiScore * this.weights.api) +
            (mlScore * this.weights.ml) +
            (historicalScore * this.weights.historical);

        return Math.min(Math.max(weighted, 0), 1);
    }

    /**
     * Determine risk level from combined score
     */
    getRiskLevel(score) {
        if (score < 0.3) return 'Low';
        if (score < 0.6) return 'Moderate';
        if (score < 0.8) return 'High';
        return 'Severe';
    }

    /**
     * Calculate overall confidence with robust NaN prevention
     * Returns valid number 0-1, fallback to 0.5 if all sources invalid
     */
    calculateOverallConfidence(apiData, mlData) {
        try {
            // Validate and sanitize API confidence
            let apiConfidence = 0.5; // default fallback
            if (apiData &&
                Number.isFinite(apiData.weather?.rainfall72h) &&
                Number.isFinite(apiData.seismic?.count)) {
                apiConfidence = 0.8;
            }

            // Validate and sanitize ML confidence
            let mlConfidence = 0.5; // default fallback
            if (mlData &&
                mlData.ml_result &&
                Number.isFinite(mlData.ml_result.confidence) &&
                mlData.ml_result.confidence >= 0 &&
                mlData.ml_result.confidence <= 1) {
                mlConfidence = mlData.ml_result.confidence;
            } else if (mlData?.ml_result?.confidence !== undefined) {
                logger.warn('ML confidence is invalid', {
                    received: mlData.ml_result.confidence,
                    type: typeof mlData.ml_result.confidence
                });
            }

            // Validate and sanitize historical confidence
            let historicalConfidence = 0.5; // default fallback
            const historicalScore = mlData?.historical_score;
            if (Number.isFinite(historicalScore) && historicalScore > 0) {
                historicalConfidence = 0.7;
            }

            // Validate weights sum to avoid division by zero
            const weightSum = this.weights.api + this.weights.ml + this.weights.historical;
            if (!Number.isFinite(weightSum) || weightSum <= 0) {
                logger.error('Invalid weight sum detected', { weightSum });
                return 0.5; // fallback
            }

            // Calculate weighted average with safe arithmetic
            const weightedSum =
                (apiConfidence * this.weights.api) +
                (mlConfidence * this.weights.ml) +
                (historicalConfidence * this.weights.historical);

            // Validate result is finite
            if (!Number.isFinite(weightedSum)) {
                logger.warn('Weighted confidence calculation resulted in NaN', {
                    apiConfidence,
                    mlConfidence,
                    historicalConfidence,
                    weights: this.weights
                });
                return 0.5; // fallback
            }

            // Ensure result is in valid range [0, 1]
            const finalConfidence = Math.max(0, Math.min(1, weightedSum));

            logger.debug('Confidence calculated', {
                api: apiConfidence,
                ml: mlConfidence,
                historical: historicalConfidence,
                final: finalConfidence
            });

            return finalConfidence;

        } catch (error) {
            logger.error('Error calculating confidence, using fallback', {
                error: error.message
            });
            return 0.5; // ultimate fallback
        }
    }
}

// Export singleton instance
module.exports = new IntegratedMLService();
