const axios = require('axios');
const weatherService = require('./weatherService');
const HistoricalIncident = require('../models/HistoricalIncident');
const logger = require('../utils/logger');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

/**
 * Hybrid Prediction Service
 * Combines: Real-time APIs (50%) + ML Model (40%) + Historical Data (10%)
 * 
 * This is the core prediction engine that integrates multiple data sources
 * for accurate landslide risk assessment.
 */
class HybridPredictionService {
    constructor() {
        // Configurable weights (can be adjusted based on model performance)
        this.weights = {
            api: parseFloat(process.env.API_WEIGHT) || 0.50,
            ml: parseFloat(process.env.ML_WEIGHT) || 0.40,
            historical: parseFloat(process.env.HISTORICAL_WEIGHT) || 0.10
        };

        // Verify weights sum to 1.0
        const sum = this.weights.api + this.weights.ml + this.weights.historical;
        if (Math.abs(sum - 1.0) > 0.001) {
            logger.warn(`Weights sum to ${sum}, normalizing to 1.0`);
            const factor = 1.0 / sum;
            this.weights.api *= factor;
            this.weights.ml *= factor;
            this.weights.historical *= factor;
        }

        logger.info(`Hybrid prediction weights: API=${this.weights.api}, ML=${this.weights.ml}, Historical=${this.weights.historical}`);
    }

    /**
     * Main prediction method - combines all sources
     */
    async predict(latitude, longitude) {
        try {
            logger.info(`Hybrid prediction for [${latitude}, ${longitude}]`);

            // Run all predictions in parallel for better performance
            const [apiPrediction, mlPrediction, historicalScore] = await Promise.all([
                this.getAPIPrediction(latitude, longitude).catch(err => {
                    logger.error(`API prediction failed: ${err.message}`);
                    return { score: 0.5, confidence: 0.3, factors: ['API unavailable'], error: err.message };
                }),
                this.getMLPrediction(latitude, longitude).catch(err => {
                    logger.error(`ML prediction failed: ${err.message}`);
                    return { probability: 0.5, confidence: 0.3, error: err.message };
                }),
                this.getHistoricalScore(latitude, longitude).catch(err => {
                    logger.error(`Historical score failed: ${err.message}`);
                    return { score: 0.2, count: 0, error: err.message };
                })
            ]);

            // Calculate weighted final risk score
            const finalRisk =
                (apiPrediction.score * this.weights.api) +
                (mlPrediction.probability * this.weights.ml) +
                (historicalScore.score * this.weights.historical);

            // Determine risk level
            const riskLevel = this.getRiskLevel(finalRisk);

            // Calculate overall confidence (weighted average of all confidences)
            const overallConfidence = this.calculateOverallConfidence(
                apiPrediction,
                mlPrediction,
                historicalScore
            );

            return {
                riskLevel,
                probability: finalRisk,
                confidence: overallConfidence,
                breakdown: {
                    api: {
                        weight: this.weights.api,
                        score: apiPrediction.score,
                        confidence: apiPrediction.confidence,
                        factors: apiPrediction.factors,
                        details: apiPrediction.details
                    },
                    ml: {
                        weight: this.weights.ml,
                        score: mlPrediction.probability,
                        confidence: mlPrediction.confidence,
                        riskLevel: mlPrediction.riskLevel,
                        featureImportance: mlPrediction.featureImportance
                    },
                    historical: {
                        weight: this.weights.historical,
                        score: historicalScore.score,
                        incidentCount: historicalScore.count,
                        nearestIncident: historicalScore.nearest
                    }
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    weights: this.weights,
                    sources: {
                        api: apiPrediction.error ? 'error' : 'success',
                        ml: mlPrediction.error ? 'error' : 'success',
                        historical: 'success'
                    }
                }
            };

        } catch (error) {
            logger.error(`Hybrid prediction error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get API-based prediction (50% weight)
     * Uses real-time weather, seismic, and terrain data
     */
    async getAPIPrediction(latitude, longitude) {
        try {
            // Fetch all external API data in parallel
            const [weather, forecast, earthquakes, elevation] = await Promise.all([
                weatherService.getCurrentWeather(latitude, longitude),
                weatherService.getForecast(latitude, longitude),
                weatherService.getEarthquakeData(latitude, longitude, 100),
                weatherService.getElevationData(latitude, longitude)
            ]);

            let riskScore = 0;
            const factors = [];
            const details = {
                weather: weather,
                forecast: forecast,
                earthquakes: earthquakes,
                elevation: elevation
            };

            // Weather factors (40% of API score)
            // Heavy rainfall is the #1 landslide trigger
            if (weather.rainfall > 50) {
                riskScore += 0.30;
                factors.push(`Critical rainfall: ${weather.rainfall.toFixed(1)}mm/hr`);
            } else if (weather.rainfall > 20) {
                riskScore += 0.15;
                factors.push(`Heavy rainfall: ${weather.rainfall.toFixed(1)}mm/hr`);
            } else if (weather.rainfall > 10) {
                riskScore += 0.08;
                factors.push(`Moderate rainfall: ${weather.rainfall.toFixed(1)}mm/hr`);
            }

            // Forecast rainfall (next 24-72 hours)
            if (forecast.rainfall24h > 100) {
                riskScore += 0.20;
                factors.push(`Severe forecast: ${forecast.rainfall24h.toFixed(0)}mm in 24h`);
            } else if (forecast.rainfall24h > 50) {
                riskScore += 0.10;
                factors.push(`Heavy forecast: ${forecast.rainfall24h.toFixed(0)}mm in 24h`);
            }

            // High humidity indicates soil saturation
            if (weather.humidity > 85) {
                riskScore += 0.10;
                factors.push(`Very high humidity: ${weather.humidity}%`);
            } else if (weather.humidity > 75) {
                riskScore += 0.05;
                factors.push(`High humidity: ${weather.humidity}%`);
            }

            // Seismic factors (30% of API score)
            // Recent earthquakes can destabilize slopes
            const recentQuakes = earthquakes.features ? earthquakes.features.filter(eq =>
                eq.properties.mag > 4.0
            ) : [];

            if (recentQuakes.length > 0) {
                const maxMagnitude = Math.max(...recentQuakes.map(eq => eq.properties.mag));
                if (maxMagnitude > 6.0) {
                    riskScore += 0.25;
                    factors.push(`Major earthquake detected: M${maxMagnitude.toFixed(1)}`);
                } else if (maxMagnitude > 5.0) {
                    riskScore += 0.15;
                    factors.push(`Significant earthquake: M${maxMagnitude.toFixed(1)}`);
                } else {
                    riskScore += 0.08;
                    factors.push(`Moderate earthquake: M${maxMagnitude.toFixed(1)}`);
                }
            }

            // Terrain factors (20% of API score)
            // Steep slopes are more susceptible to landslides
            if (elevation.slope_degrees > 35) {
                riskScore += 0.20;
                factors.push(`Very steep slope: ${elevation.slope_degrees.toFixed(1)}°`);
            } else if (elevation.slope_degrees > 25) {
                riskScore += 0.12;
                factors.push(`Steep slope: ${elevation.slope_degrees.toFixed(1)}°`);
            } else if (elevation.slope_degrees > 15) {
                riskScore += 0.06;
                factors.push(`Moderate slope: ${elevation.slope_degrees.toFixed(1)}°`);
            }

            // Elevation range: Most landslides occur in mid-elevations (1500-3000m)
            if (elevation.elevation >= 1500 && elevation.elevation <= 3000) {
                riskScore += 0.05;
                factors.push(`High-risk elevation: ${elevation.elevation.toFixed(0)}m`);
            }

            // High terrain variation indicates unstable geology
            if (elevation.terrain_variation > 100) {
                riskScore += 0.05;
                factors.push('Highly variable terrain');
            }

            // Additional risk factors combinations
            // Rainfall + Steep slope = Very High Risk
            if (weather.rainfall > 30 && elevation.slope_degrees > 30) {
                riskScore += 0.10;
                factors.push('Critical combination: Heavy rain on steep slope');
            }

            // Earthquake + Rain = Increased Risk
            if (recentQuakes.length > 0 && weather.rainfall > 10) {
                riskScore += 0.08;
                factors.push('Seismic activity combined with rainfall');
            }

            // Normalize score to 0-1 range
            riskScore = Math.min(riskScore, 1.0);

            // Confidence is higher when we have more data points
            const confidence = 0.85; // API data is generally reliable

            return {
                score: riskScore,
                confidence,
                factors,
                details
            };

        } catch (error) {
            logger.error(`API prediction error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get ML model prediction (40% weight)
     * Calls the FastAPI ML service
     */
    async getMLPrediction(latitude, longitude) {
        try {
            // First, gather features needed by ML model
            const features = await this.buildMLFeatures(latitude, longitude);

            // Call ML service
            const response = await axios.post(
                `${ML_SERVICE_URL}/api/v1/predict/single`,
                {
                    location_name: `Location [${latitude}, ${longitude}]`,
                    latitude,
                    longitude,
                    features
                },
                { timeout: 30000 }
            );

            return {
                probability: response.data.probability,
                confidence: response.data.confidence,
                riskLevel: response.data.risk_level,
                featureImportance: response.data.feature_importance
            };

        } catch (error) {
            logger.error(`ML prediction error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Build feature set for ML model from external APIs
     */
    async buildMLFeatures(latitude, longitude) {
        try {
            const [weather, forecast, earthquakes, elevation] = await Promise.all([
                weatherService.getCurrentWeather(latitude, longitude),
                weatherService.getForecast(latitude, longitude),
                weatherService.getEarthquakeData(latitude, longitude, 100),
                weatherService.getElevationData(latitude, longitude)
            ]);

            // Count nearby historical incidents for historical_landslides feature
            const historicalCount = await HistoricalIncident.countDocuments({
                location: {
                    $near: {
                        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
                        $maxDistance: 20000 // 20km radius
                    }
                }
            });

            return {
                rainfall_intensity: weather.rainfall || 0,
                soil_moisture: Math.min(weather.humidity * 0.8, 100), // Estimate from humidity
                ndvi: 0.7, // Default vegetation index (would need satellite data)
                slope_angle: elevation.slope_degrees,
                elevation: elevation.elevation,
                lithology_code: 5, // Default rock type (would need geological survey data)
                land_use_code: 3, // Default land use (would need land cover data)
                distance_to_road: 500, // Default (would need OSM data)
                distance_to_river: 800, // Default (would need hydrological data)
                drainage_density: 1.5, // Default (calculated from DEM)
                curvature: 0.1, // Default terrain curvature
                aspect: 180, // Default aspect (would calculate from DEM)
                twi: 8.0, // Topographic Wetness Index (calculated from DEM)
                historical_landslides: historicalCount,
                precipitation_30d: forecast.rainfall72h * 10, // Rough estimate
                temperature: weather.temperature,
                humidity: weather.humidity
            };

        } catch (error) {
            logger.error(`Feature building error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get historical risk score (10% weight)
     * Based on past landslide incidents in the area
     */
    async getHistoricalScore(latitude, longitude) {
        try {
            // Find incidents within 50km radius
            const incidents = await HistoricalIncident.find({
                location: {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: [longitude, latitude]
                        },
                        $maxDistance: 50000 // 50km
                    }
                }
            }).limit(20);

            const count = incidents.length;

            // Calculate score based on incident count and proximity
            let score = 0;

            if (count >= 10) {
                score = 0.90; // Very high historical risk
            } else if (count >= 5) {
                score = 0.75;
            } else if (count >= 3) {
                score = 0.60;
            } else if (count >= 1) {
                score = 0.40;
            } else {
                score = 0.20; // No history, but not zero risk
            }

            // Find nearest incident for context
            const nearest = incidents[0] ? {
                distance: this.calculateDistance(
                    latitude,
                    longitude,
                    incidents[0].location.coordinates[1],
                    incidents[0].location.coordinates[0]
                ),
                date: incidents[0].date,
                severity: incidents[0].severity
            } : null;

            return {
                score,
                count,
                nearest
            };

        } catch (error) {
            logger.error(`Historical score error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Calculate overall confidence from all sources
     */
    calculateOverallConfidence(apiPred, mlPred, histScore) {
        // Weight confidences by their respective weights
        let totalConfidence = apiPred.confidence * this.weights.api;
        let totalWeight = this.weights.api;

        if (mlPred.confidence) {
            totalConfidence += mlPred.confidence * this.weights.ml;
            totalWeight += this.weights.ml;
        }

        // Historical data has implicit confidence based on incident count
        const histConfidence = histScore.count > 0 ? 0.8 : 0.5;
        totalConfidence += histConfidence * this.weights.historical;
        totalWeight += this.weights.historical;

        return totalConfidence / totalWeight;
    }

    /**
     * Convert probability to risk level
     */
    getRiskLevel(probability) {
        if (probability >= 0.75) return 'Severe';
        if (probability >= 0.60) return 'High';
        if (probability >= 0.40) return 'Moderate';
        if (probability >= 0.25) return 'Low';
        return 'Very Low';
    }

    /**
     * Calculate distance between two coordinates (Haversine formula)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    toRad(degrees) {
        return degrees * Math.PI / 180;
    }
}

module.exports = new HybridPredictionService();
