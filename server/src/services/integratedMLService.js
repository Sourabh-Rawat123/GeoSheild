/**
 * Integrated ML Service
 * Combines API data (50%) + ML predictions (40%) + Historical CSV data (10%)
 * ML runs directly in backend process via Python script
 */

const { PythonShell } = require('python-shell');
const path = require('path');
const weatherService = require('./weatherService');
const logger = require('../utils/logger');

class IntegratedMLService {
    constructor() {
        this.pythonScriptPath = path.join(__dirname, '..', '..', 'ml', 'predict.py');

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

        logger.info('IntegratedMLService initialized', { weights: this.weights });
    }

    /**
     * Main prediction method - combines all sources
     */
    async predict(latitude, longitude) {
        try {
            logger.info('Starting integrated prediction', { latitude, longitude });

            // Step 1: Get API data (50% weight)
            const apiData = await this.getAPIData(latitude, longitude);
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
            const [weather, seismic, elevation] = await Promise.all([
                weatherService.getCurrentWeather(latitude, longitude),
                weatherService.getEarthquakeData(latitude, longitude, 100),
                weatherService.getElevationData(latitude, longitude)
            ]);

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

        // Rainfall factor (40% of API score)
        const rainfall72h = apiData.weather.rainfall72h;
        if (rainfall72h > 100) score += 0.4;
        else if (rainfall72h > 50) score += 0.3;
        else if (rainfall72h > 20) score += 0.2;
        else score += rainfall72h / 100 * 0.2;

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
     * Run ML prediction using Python script
     */
    async runMLPrediction(latitude, longitude, features) {
        return new Promise((resolve, reject) => {
            const options = {
                mode: 'text',  // Changed from 'json' to 'text' to avoid double-parsing
                pythonPath: process.env.PYTHON_PATH || 'python',
                pythonOptions: ['-u'],
                scriptPath: path.dirname(this.pythonScriptPath),
                args: []
            };

            const pyshell = new PythonShell('predict.py', options);

            // Send input data to Python script
            const inputData = {
                latitude,
                longitude,
                features
            };

            // Send as JSON string - Python will parse it
            pyshell.send(JSON.stringify(inputData));

            let result = null;
            let stderrOutput = [];

            pyshell.on('message', (message) => {
                // In text mode, manually parse JSON response
                try {
                    result = JSON.parse(message);
                } catch (e) {
                    logger.warn('Failed to parse Python response as JSON', { message, error: e.message });
                    result = message;
                }
            });

            // Capture stderr for debugging but don't treat [DEBUG] as errors
            pyshell.on('stderr', (stderr) => {
                const line = stderr.toString();
                stderrOutput.push(line);
                // Only log non-DEBUG messages as warnings
                if (!line.startsWith('[DEBUG]')) {
                    logger.warn('Python stderr', { message: line });
                }
            });

            pyshell.end((err) => {
                if (err) {
                    // Filter out [DEBUG] messages from error
                    const errorMsg = err.message.split('\n')
                        .filter(line => !line.includes('[DEBUG]'))
                        .join('\n')
                        .trim();

                    if (errorMsg) {
                        logger.error('Python ML script failed', { error: errorMsg });
                        reject(new Error(`ML prediction failed: ${errorMsg}`));
                    } else {
                        // All errors were just DEBUG messages, no real error
                        if (!result) {
                            reject(new Error('ML prediction returned no data'));
                        } else {
                            resolve(result);
                        }
                    }
                } else if (!result) {
                    reject(new Error('ML prediction returned no data'));
                } else {
                    resolve(result);
                }
            });
        });
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
     * Calculate overall confidence
     */
    calculateOverallConfidence(apiData, mlData) {
        // API confidence (based on data completeness)
        const apiConfidence = (apiData.weather.rainfall72h !== undefined &&
            apiData.seismic.count !== undefined) ? 0.8 : 0.5;

        // ML confidence from model
        const mlConfidence = mlData.ml_result.confidence || 0.5;

        // Historical confidence (based on data availability)
        const historicalConfidence = mlData.historical_score > 0 ? 0.7 : 0.5;

        // Weighted average
        return (apiConfidence * this.weights.api +
            mlConfidence * this.weights.ml +
            historicalConfidence * this.weights.historical);
    }
}

// Export singleton instance
module.exports = new IntegratedMLService();
