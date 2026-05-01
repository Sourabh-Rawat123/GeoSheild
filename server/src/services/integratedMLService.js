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

            const [weather, seismic, elevation] = await Promise.all([
                weatherService.getCurrentWeather(latitude, longitude),
                weatherService.getEarthquakeData(latitude, longitude, 100),
                weatherService.getElevationData(latitude, longitude)
            ]);

            console.log(`🟠 All APIs called successfully. Returning data for [${latitude}, ${longitude}]`);

            return {
                weather: {
                    temperature: weather.main?.temp || 25,
                    humidity: weather.main?.humidity || 50,
                    pressure: weather.main?.pressure || 1013,
                    windSpeed: weather.wind?.speed || 0,
                    rainfall24h: weather.rainfall24h || 0,
                    rainfall72h: weather.rainfall72h || 0
                },
                seismic: {
                    count: seismic.count || 0,
                    maxMagnitude: seismic.maxMagnitude || 0,
                    avgMagnitude: seismic.avgMagnitude || 0
                },
                terrain: {
                    elevation: elevation.elevation || 0,
                    slope: elevation.slope || 0
                }
            };
        } catch (error) {
            console.error(`🟠 API data fetch failed:`, error.message);
            logger.warn('API data fetch failed, using defaults', { error: error.message });
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
    calculateAPIScore(apiData) {
        let score = 0;

        // Rainfall factor (40% of API score) - Using 24h rainfall
        const rainfall24h = apiData.weather.rainfall24h;
        if (rainfall24h > 50) score += 0.4;          // Heavy rainfall (>50mm/24h)
        else if (rainfall24h > 30) score += 0.3;     // Moderate rainfall (30-50mm)
        else if (rainfall24h > 15) score += 0.2;     // Light-moderate rainfall (15-30mm)
        else score += rainfall24h / 50 * 0.2;        // Proportional for light rain

        // Earthquake factor (30% of API score)
        if (apiData.seismic.maxMagnitude > 5.0) score += 0.3;
        else if (apiData.seismic.maxMagnitude > 4.0) score += 0.2;
        else if (apiData.seismic.maxMagnitude > 3.0) score += 0.1;
        else score += apiData.seismic.maxMagnitude / 30;

        // Slope factor (20% of API score)
        const slope = apiData.terrain.slope;
        if (slope > 30) score += 0.2;
        else if (slope > 20) score += 0.15;
        else if (slope > 10) score += 0.1;
        else score += slope / 100 * 0.1;

        // Humidity factor (10% of API score)
        const humidity = apiData.weather.humidity;
        if (humidity > 80) score += 0.1;
        else if (humidity > 60) score += 0.05;
        else score += humidity / 1000;

        return Math.min(score, 1.0);
    }

    /**
     * Build feature set for ML model
     */
    buildFeatures(apiData, latitude, longitude) {
        return {
            latitude,
            longitude,
            temperature: apiData.weather.temperature,
            humidity: apiData.weather.humidity,
            pressure: apiData.weather.pressure,
            wind_speed: apiData.weather.windSpeed,
            rainfall_24h: apiData.weather.rainfall24h,
            rainfall_72h: apiData.weather.rainfall72h,
            elevation: apiData.terrain.elevation,
            slope: apiData.terrain.slope,
            earthquake_count: apiData.seismic.count,
            max_earthquake_magnitude: apiData.seismic.maxMagnitude,
            soil_moisture: 0.5, // Default - can be enhanced
            ndvi: 0.5, // Default - can be enhanced
            distance_to_fault: 10.0, // Default - can be enhanced
            population_density: 100 // Default - can be enhanced
        };
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
