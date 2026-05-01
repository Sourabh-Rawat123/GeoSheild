const axios = require('axios');
const logger = require('../utils/logger');
const elevationService = require('./elevationService');

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '';
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

/**
 * Request queue with concurrency limiting
 * Prevents overwhelming APIs with too many parallel requests
 */
class RequestQueue {
    constructor(maxConcurrent = 2) {
        this.maxConcurrent = maxConcurrent;
        this.activeRequests = 0;
        this.queue = [];
    }

    async run(fn) {
        while (this.activeRequests >= this.maxConcurrent) {
            await new Promise(resolve => this.queue.push(resolve));
        }

        this.activeRequests++;
        try {
            return await fn();
        } finally {
            this.activeRequests--;
            const resolve = this.queue.shift();
            if (resolve) resolve();
        }
    }
}

class WeatherService {
    constructor() {
        // Concurrency queues to prevent overwhelming APIs
        this.weatherQueue = new RequestQueue(2); // Max 2 concurrent weather API calls
        this.earthquakeQueue = new RequestQueue(2); // Max 2 concurrent earthquake API calls
        logger.info('WeatherService initialized with concurrency limiting (max 2 parallel requests per API)');
    }

    /**
     * Retry helper with exponential backoff
     * Retries on transient errors (timeouts, 5xx, 429, etc)
     */
    async retryWithBackoff(fn, maxAttempts = 3, initialDelayMs = 1000) {
        let lastError;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`🔄 Attempt ${attempt}/${maxAttempts}`);
                return await fn();
            } catch (error) {
                lastError = error;

                // Always retry on rate limit (429), timeouts, and 5xx errors
                const isRateLimit = error.response?.status === 429;
                const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
                const isServerError = error.response?.status >= 500;
                const shouldRetry = isRateLimit || isTimeout || isServerError;

                // Don't retry other 4xx client errors
                if (!shouldRetry && error.response?.status && error.response.status < 500) {
                    throw error;
                }

                // Don't retry on the last attempt
                if (attempt === maxAttempts) {
                    break;
                }

                // For 429 rate limits, use longer backoff with jitter
                let delayMs;
                if (isRateLimit) {
                    delayMs = initialDelayMs * Math.pow(3, attempt - 1); // 1s, 3s, 9s for rate limits
                    const jitter = Math.random() * delayMs * 0.1; // Add 10% jitter
                    delayMs += jitter;
                    console.log(`⏳ Rate limited (429). Retrying in ${delayMs.toFixed(0)}ms...`);
                } else {
                    delayMs = initialDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s for other errors
                    console.log(`⏳ Retrying in ${delayMs.toFixed(0)}ms...`);
                }

                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        throw lastError;
    }
    /**
     * Get current weather data for a location
     * Uses request queue to limit concurrent API calls
     */
    async getCurrentWeather(lat, lon) {
        try {
            // === DEBUG: Log coordinates ===
            console.log(`🟡 weatherService.getCurrentWeather() called`);
            console.log(`🟡   Latitude: ${lat} (type: ${typeof lat})`);
            console.log(`🟡   Longitude: ${lon} (type: ${typeof lon})`);
            // ================================

            if (!OPENWEATHER_API_KEY) {
                logger.warn('OpenWeather API key not configured, returning mock data');
                return this.getMockWeatherData(lat, lon);
            }

            // Use request queue to limit concurrent calls (max 2 parallel)
            const response = await this.weatherQueue.run(async () => {
                return await this.retryWithBackoff(async () => {
                    return await axios.get(`${OPENWEATHER_BASE_URL}/weather`, {
                        params: {
                            lat,
                            lon,
                            appid: OPENWEATHER_API_KEY,
                            units: 'metric'
                        },
                        timeout: 5000
                    });
                }, 3, 1000);
            });

            const data = response.data;

            console.log(`🟡 OpenWeather API response for [${lat}, ${lon}]:`, {
                temp: data.main?.temp,
                apiLat: data.coord?.lat,
                apiLon: data.coord?.lon
            });

            return {
                temperature: data.main.temp,
                humidity: data.main.humidity,
                pressure: data.main.pressure,
                windSpeed: data.wind.speed,
                rainfall: data.rain?.['1h'] || 0,
                description: data.weather[0].description,
                icon: data.weather[0].icon,
                timestamp: new Date(data.dt * 1000)
            };
        } catch (err) {
            console.error(`🟡 Weather API error:`, err.message);
            logger.error(`Weather API error: ${err.message}`);
            return this.getMockWeatherData(lat, lon);
        }
    }

    /**
     * Get weather forecast for next 5 days with retry logic
     */
    async getForecast(lat, lon) {
        try {
            if (!OPENWEATHER_API_KEY) {
                logger.warn('OpenWeather API key not configured, returning mock forecast');
                return this.getMockForecast(lat, lon);
            }

            const response = await this.retryWithBackoff(async () => {
                return await axios.get(`${OPENWEATHER_BASE_URL}/forecast`, {
                    params: {
                        lat,
                        lon,
                        appid: OPENWEATHER_API_KEY,
                        units: 'metric'
                    },
                    timeout: 5000
                });
            }, 3, 1000);

            const forecast = response.data.list.map(item => ({
                timestamp: new Date(item.dt * 1000),
                temperature: item.main.temp,
                humidity: item.main.humidity,
                rainfall: item.rain?.['3h'] || 0,
                windSpeed: item.wind.speed,
                description: item.weather[0].description
            }));

            return {
                forecast,
                rainfall24h: this.calculateRainfall(forecast, 24),
                rainfall72h: this.calculateRainfall(forecast, 72)
            };
        } catch (err) {
            logger.error(`Forecast API error: ${err.message}`);
            return this.getMockForecast(lat, lon);
        }
    }

    /**
     * Calculate total rainfall over specified hours
     */
    calculateRainfall(forecast, hours) {
        const now = new Date();
        const futureTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

        const relevantForecasts = forecast.filter(f =>
            f.timestamp >= now && f.timestamp <= futureTime
        );

        return relevantForecasts.reduce((sum, f) => sum + f.rainfall, 0);
    }

    /**
     * Check if there's a rainfall alert for the location
     */
    async getRainfallAlert(lat, lon) {
        try {
            const forecast = await this.getForecast(lat, lon);
            const current = await this.getCurrentWeather(lat, lon);

            const alerts = [];

            // Heavy rainfall alert (>50mm in 24h)
            if (forecast.rainfall24h > 50) {
                alerts.push({
                    severity: 'high',
                    type: 'heavy_rainfall',
                    message: `Heavy rainfall expected: ${forecast.rainfall24h.toFixed(1)}mm in next 24 hours`,
                    rainfallMm: forecast.rainfall24h,
                    duration: '24h'
                });
            }
            // Moderate rainfall alert (>25mm in 24h)
            else if (forecast.rainfall24h > 25) {
                alerts.push({
                    severity: 'moderate',
                    type: 'moderate_rainfall',
                    message: `Moderate rainfall expected: ${forecast.rainfall24h.toFixed(1)}mm in next 24 hours`,
                    rainfallMm: forecast.rainfall24h,
                    duration: '24h'
                });
            }

            // Extended heavy rainfall alert (>100mm in 72h)
            if (forecast.rainfall72h > 100) {
                alerts.push({
                    severity: 'severe',
                    type: 'extended_rainfall',
                    message: `Prolonged heavy rainfall: ${forecast.rainfall72h.toFixed(1)}mm over next 72 hours`,
                    rainfallMm: forecast.rainfall72h,
                    duration: '72h'
                });
            }

            return {
                hasAlert: alerts.length > 0,
                alerts,
                current,
                forecast: forecast.rainfall24h,
                forecast72h: forecast.rainfall72h
            };
        } catch (err) {
            logger.error(`Rainfall alert error: ${err.message}`);
            return { hasAlert: false, alerts: [], error: err.message };
        }
    }

    /**
     * Get elevation and slope data
     * Uses dedicated elevationService with caching and rate limiting
     */
    async getElevationData(lat, lon) {
        try {
            // Delegates to elevationService which handles:
            // - In-memory LRU cache (100 locations)
            // - Concurrency limiting (max 2 concurrent requests)
            // - Exponential backoff retry for 429 errors
            return await elevationService.getElevationData(lat, lon);
        } catch (err) {
            logger.error(`Elevation data fetch failed: ${err.message}`);
            return { elevation: 0, slope_degrees: 0, terrain_variation: 0, isFallback: true };
        }
    }

    /**
     * Get earthquake data with retry logic
     * Uses request queue to limit concurrent API calls
     */
    async getEarthquakeData(lat, lon, radiusKm = 100) {
        try {
            const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const startTime = thirtyDaysAgo.toISOString().split('T')[0];

            // Use request queue to limit concurrent calls (max 2 parallel)
            const response = await this.earthquakeQueue.run(async () => {
                return await this.retryWithBackoff(async () => {
                    return await axios.get(url, {
                        params: {
                            format: 'geojson',
                            latitude: lat,
                            longitude: lon,
                            maxradiuskm: radiusKm,
                            starttime: startTime,
                            minmagnitude: 2.5
                        },
                        timeout: 5000
                    });
                }, 3, 1000);
            });

            const earthquakes = response.data.features;

            if (earthquakes.length === 0) {
                return {
                    count: 0,
                    maxMagnitude: 0,
                    avgMagnitude: 0
                };
            }

            const magnitudes = earthquakes.map(eq => eq.properties.mag);

            return {
                count: earthquakes.length,
                maxMagnitude: Math.max(...magnitudes),
                avgMagnitude: magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length
            };
        } catch (err) {
            console.error(`🔴 Earthquake API error:`, err.message);
            logger.error(`Earthquake API error: ${err.message}`);
            return {
                count: 0,
                maxMagnitude: 0,
                avgMagnitude: 0
            };
        }
    }

    /**
     * Get all environmental data at once
     */
    async getAllEnvironmentalData(lat, lon) {
        try {
            // Call all APIs in parallel for speed
            const [weather, elevation, seismic] = await Promise.all([
                this.getCurrentWeather(lat, lon),
                this.getElevationData(lat, lon),
                this.getEarthquakeData(lat, lon)
            ]);

            return {
                weather,
                elevation,
                seismic,
                timestamp: new Date(),
                location: { lat, lon }
            };
        } catch (err) {
            logger.error(`Error fetching environmental data: ${err.message}`);
            throw err;
        }
    }




    /**
     * Mock weather data for development
     */
    getMockWeatherData(lat, lon) {
        const rainfall = Math.random() * 30; // Random rainfall 0-30mm

        return {
            temperature: 22 + Math.random() * 10,
            humidity: 60 + Math.random() * 30,
            pressure: 1010 + Math.random() * 20,
            windSpeed: Math.random() * 15,
            rainfall,
            description: rainfall > 10 ? 'Heavy rain' : rainfall > 5 ? 'Light rain' : 'Partly cloudy',
            icon: '10d',
            timestamp: new Date(),
            isMock: true
        };
    }

    /**
     * Mock forecast data for development
     */
    getMockForecast(lat, lon) {
        const forecast = [];
        const now = new Date();

        for (let i = 0; i < 40; i++) {
            const time = new Date(now.getTime() + i * 3 * 60 * 60 * 1000);
            forecast.push({
                timestamp: time,
                temperature: 20 + Math.random() * 12,
                humidity: 60 + Math.random() * 30,
                rainfall: Math.random() * 15,
                windSpeed: Math.random() * 12,
                description: 'Variable conditions'
            });
        }

        return {
            forecast,
            rainfall24h: this.calculateRainfall(forecast, 24),
            rainfall72h: this.calculateRainfall(forecast, 72),
            isMock: true
        };
    }
}

module.exports = new WeatherService();




















