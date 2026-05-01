/**
 * ML Service Client
 * Communicates with the ml-service (FastAPI) via HTTP REST API
 *
 * ARCHITECTURE:
 * - Backend calls ml-service via REST API (not Python subprocess)
 * - ml-service listens on port 8001
 * - All ML logic is decoupled and independently scalable
 */

const axios = require('axios');
const logger = require('../utils/logger');

class MLServiceClient {
    constructor() {
        this.baseURL = process.env.ML_SERVICE_URL || 'http://localhost:8001';
        this.timeout = 30000; // 30 seconds

        // Create axios instance with retries
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: this.timeout,
            validateStatus: () => true // Don't throw on any status code
        });

        logger.info(`MLServiceClient initialized with baseURL: ${this.baseURL}`);
    }

    /**
     * Health check - verify ml-service is running
     */
    async healthCheck() {
        try {
            const response = await this.client.get('/health');
            if (response.status === 200) {
                logger.info('ML Service health check: OK');
                return true;
            } else {
                logger.warn(`ML Service health check failed: ${response.status}`);
                return false;
            }
        } catch (error) {
            logger.error(`ML Service connection failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Single prediction
     * @param {number} latitude
     * @param {number} longitude
     * @param {object} features - location features with weather, seismic, terrain data
     * @returns {object} prediction result
     */
    async predictSingle(latitude, longitude, features) {
        try {
            logger.debug(`Calling ml-service /predict/single for [${latitude}, ${longitude}]`);

            // Format data for ML service - it expects weather, earthquake, and elevation dicts
            const payload = {
                location_name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                latitude,
                longitude,
                // Weather data in OpenWeatherMap format
                weather: {
                    main: {
                        temp: (features.weather?.temperature || 25) + 273.15, // Convert to Kelvin
                        humidity: features.weather?.humidity || 50,
                        pressure: features.weather?.pressure || 1013
                    },
                    wind: {
                        speed: features.weather?.windSpeed || 0
                    },
                    rain: {
                        '1h': (features.weather?.rainfall24h || 0) / 24 // Convert daily to hourly estimate
                    }
                },
                // Earthquake data in GeoJSON format
                earthquake: {
                    features: (features.seismic?.count || 0) > 0 ? [
                        {
                            properties: {
                                mag: features.seismic?.maxMagnitude || 0
                            },
                            geometry: {
                                coordinates: [longitude, latitude, 0]
                            }
                        }
                    ] : []
                },
                // Elevation data
                elevation: [
                    latitude,
                    longitude,
                    features.terrain?.elevation || 0
                ]
            };

            const response = await this.client.post('/api/v1/predict/single', payload);

            if (response.status !== 200) {
                throw new Error(`ML Service error: ${response.status} - ${response.data?.detail || 'Unknown error'}`);
            }

            return this._formatResponse(response.data, latitude, longitude);

        } catch (error) {
            logger.warn(`ML Service unavailable, using fallback prediction: ${error.message}`);
            // Return fallback prediction based on features
            return this._getFallbackPrediction(latitude, longitude, features);
        }
    }

    /**
     * Batch prediction
     * @param {array} locations - array of {latitude, longitude, features}
     * @returns {object} batch result
     */
    async predictBatch(locations) {
        try {
            logger.debug(`Calling ml-service /predict/batch for ${locations.length} locations`);

            const formattedLocations = locations.map(loc => ({
                location_name: `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`,
                latitude: loc.latitude,
                longitude: loc.longitude,
                weather: {
                    main: {
                        temp: (loc.features.weather?.temperature || 25) + 273.15,
                        humidity: loc.features.weather?.humidity || 50,
                        pressure: loc.features.weather?.pressure || 1013
                    },
                    wind: {
                        speed: loc.features.weather?.windSpeed || 0
                    },
                    rain: {
                        '1h': (loc.features.weather?.rainfall24h || 0) / 24
                    }
                },
                earthquake: {
                    features: (loc.features.seismic?.count || 0) > 0 ? [
                        {
                            properties: {
                                mag: loc.features.seismic?.maxMagnitude || 0
                            },
                            geometry: {
                                coordinates: [loc.longitude, loc.latitude, 0]
                            }
                        }
                    ] : []
                },
                elevation: [
                    loc.latitude,
                    loc.longitude,
                    loc.features.terrain?.elevation || 0
                ]
            }));

            const response = await this.client.post('/api/v1/predict/batch', {
                locations: formattedLocations
            });

            if (response.status !== 200) {
                throw new Error(`ML Service batch error: ${response.status} - ${response.data?.detail || 'Unknown error'}`);
            }

            return response.data;

        } catch (error) {
            logger.error(`ML Service batch prediction failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Risk zones heatmap
     * @param {number} minLat, maxLat, minLon, maxLon
     * @param {number} gridSize
     * @returns {object} risk grid
     */
    async getRiskZones(minLat, maxLat, minLon, maxLon, gridSize = 10) {
        try {
            logger.debug(`Calling ml-service /predict/risk-zones`);

            const response = await this.client.get('/api/v1/predict/risk-zones', {
                params: {
                    min_latitude: minLat,
                    max_latitude: maxLat,
                    min_longitude: minLon,
                    max_longitude: maxLon,
                    grid_size: gridSize
                }
            });

            if (response.status !== 200) {
                throw new Error(`ML Service error: ${response.status} - ${response.data?.detail || 'Unknown error'}`);
            }

            return response.data;

        } catch (error) {
            logger.error(`ML Service risk zones failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Format ml-service response to match backend expectations
     */
    _formatResponse(mlResponse, latitude, longitude) {
        // ml-service returns PredictionResponse format
        return {
            success: true,
            ml_result: {
                success: true,
                ml_probability: mlResponse.probability || 0.5,
                raw_probability: mlResponse.probability || 0.5,
                risk_level: mlResponse.risk_level || 'UNKNOWN',
                confidence: mlResponse.confidence || 0.5,
                feature_count: 17,
                district_info: {
                    district_rank: 0,
                    district_name: 'Unknown',
                    state_name: 'Unknown',
                    risk_multiplier: 1.0
                }
            },
            historical_score: 0, // Can be enhanced from ml-service
            latitude,
            longitude
        };
    }

    /**
     * Fallback prediction when ml-service is unavailable
     */
    _getFallbackPrediction(latitude, longitude, features) {
        // Simple heuristic-based prediction
        let probability = 0;

        // Heavy rainfall increases risk significantly
        if (features.rainfall_24h > 50) probability += 0.35;
        else if (features.rainfall_24h > 30) probability += 0.25;
        else if (features.rainfall_24h > 15) probability += 0.15;
        else probability += (features.rainfall_24h / 50) * 0.1;

        // Steep slopes increase risk
        if (features.slope > 30) probability += 0.25;
        else if (features.slope > 20) probability += 0.15;
        else if (features.slope > 10) probability += 0.08;

        // High humidity + rainfall combo
        if (features.humidity > 80 && features.rainfall_24h > 20) probability += 0.15;

        // Earthquakes increase risk
        if (features.earthquake_count > 0) probability += 0.1;

        // Cap at 1.0
        probability = Math.min(Math.max(probability, 0), 1.0);

        // Determine risk level
        let risk_level = 'Low';
        if (probability < 0.3) risk_level = 'Low';
        else if (probability < 0.6) risk_level = 'Moderate';
        else if (probability < 0.8) risk_level = 'High';
        else risk_level = 'Severe';

        return {
            success: true,
            ml_result: {
                success: true,
                ml_probability: probability,
                raw_probability: probability,
                risk_level: risk_level,
                confidence: 0.6, // Lower confidence for fallback
                feature_count: 17,
                district_info: {
                    district_rank: 0,
                    district_name: 'Unknown',
                    state_name: 'Unknown',
                    risk_multiplier: 1.0
                }
            },
            historical_score: 0,
            latitude,
            longitude
        };
    }
}

module.exports = new MLServiceClient();
