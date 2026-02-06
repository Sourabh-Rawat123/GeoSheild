const axios = require('axios');
const logger = require('../utils/logger');

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '';
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

class WeatherService {
    /**
     * Get current weather data for a location
     */
    async getCurrentWeather(lat, lon) {
        try {
            if (!OPENWEATHER_API_KEY) {
                logger.warn('OpenWeather API key not configured, returning mock data');
                return this.getMockWeatherData(lat, lon);
            }

            const response = await axios.get(`${OPENWEATHER_BASE_URL}/weather`, {
                params: {
                    lat,
                    lon,
                    appid: OPENWEATHER_API_KEY,
                    units: 'metric'
                },
                timeout: 5000
            });

            const data = response.data;

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
            logger.error(`Weather API error: ${err.message}`);
            return this.getMockWeatherData(lat, lon);
        }
    }

    /**
     * Get weather forecast for next 5 days
     */
    async getForecast(lat, lon) {
        try {
            if (!OPENWEATHER_API_KEY) {
                logger.warn('OpenWeather API key not configured, returning mock forecast');
                return this.getMockForecast(lat, lon);
            }

            const response = await axios.get(`${OPENWEATHER_BASE_URL}/forecast`, {
                params: {
                    lat,
                    lon,
                    appid: OPENWEATHER_API_KEY,
                    units: 'metric'
                },
                timeout: 5000
            });

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
     */
    async getElevationData(lat, lon) {
        try {
            const url = 'https://api.open-elevation.com/api/v1/lookup';
            
            const locations = [
                {latitude: lat, longitude: lon},
                {latitude: lat + 0.001, longitude: lon},
                {latitude: lat, longitude: lon + 0.001}
            ];
            
            const response = await axios.post(url, {locations}, {timeout: 5000});
            const results = response.data.results;
            
            const elevations = results.map(r => r.elevation);
            const rise = Math.max(
                Math.abs(elevations[1] - elevations[0]),
                Math.abs(elevations[2] - elevations[0])
            );
            const slopeDegrees = Math.atan(rise / 111) * (180 / Math.PI);
            
            return {
                elevation: elevations[0],
                slope_degrees: slopeDegrees,
                terrain_variation: Math.max(...elevations) - Math.min(...elevations)
            };
        } catch (err) {
            logger.error(`Elevation API error: ${err.message}`);
            return {elevation: 0, slope_degrees: 0, terrain_variation: 0};
        }
    }

    /**
     * Get earthquake data
     */
    async getEarthquakeData(lat, lon, radiusKm = 100) {
        try {
            const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
            
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const startTime = thirtyDaysAgo.toISOString().split('T')[0];
            
            const response = await axios.get(url, {
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
            
            const earthquakes = response.data.features;
            
            if (earthquakes.length === 0) {
                return {
                    earthquake_count: 0,
                    max_magnitude: 0,
                    recent_earthquake: false
                };
            }
            
            const magnitudes = earthquakes.map(eq => eq.properties.mag);
            
            return {
                earthquake_count: earthquakes.length,
                max_magnitude: Math.max(...magnitudes),
                recent_earthquake: true,
                latest_earthquake: {
                    magnitude: earthquakes[0].properties.mag,
                    location: earthquakes[0].properties.place,
                    time: new Date(earthquakes[0].properties.time)
                }
            };
        } catch (err) {
            logger.error(`Earthquake API error: ${err.message}`);
            return {
                earthquake_count: 0,
                max_magnitude: 0,
                recent_earthquake: false
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
                location: {lat, lon}
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




















