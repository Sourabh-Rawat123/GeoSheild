const weatherService = require('../services/weatherService');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/async_handler');
const ApiError = require('../utils/api_error');

/**
 * @desc    Get current weather for location
 * @route   GET /api/weather/current
 * @access  Private
 */
exports.getCurrentWeather = asyncHandler(async (req, res) => {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
        throw new ApiError('Latitude and longitude are required', 400);
    }

    const weather = await weatherService.getCurrentWeather(
        parseFloat(lat),
        parseFloat(lon)
    );

    res.json({
        success: true,
        weather
    });
});

/**
 * @desc    Get weather forecast
 * @route   GET /api/weather/forecast
 * @access  Private
 */
exports.getForecast = asyncHandler(async (req, res) => {
    const { lat, lon, days = 5 } = req.query;

    if (!lat || !lon) {
        throw new ApiError('Latitude and longitude are required', 400);
    }

    const forecast = await weatherService.getForecast(
        parseFloat(lat),
        parseFloat(lon),
        parseInt(days)
    );

    res.json({
        success: true,
        forecast
    });
});

/**
 * @desc    Get weather alerts for location
 * @route   GET /api/weather/alerts
 * @access  Private
 */
exports.getWeatherAlerts = asyncHandler(async (req, res) => {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
        throw new ApiError('Latitude and longitude are required', 400);
    }

    const alerts = await weatherService.getWeatherAlerts(
        parseFloat(lat),
        parseFloat(lon)
    );

    res.json({
        success: true,
        alerts
    });
});

/**
 * @desc    Get historical weather data
 * @route   GET /api/weather/historical
 * @access  Private
 */
exports.getHistoricalWeather = asyncHandler(async (req, res) => {
    const { lat, lon, startDate, endDate } = req.query;

    if (!lat || !lon || !startDate || !endDate) {
        throw new ApiError('Latitude, longitude, startDate, and endDate are required', 400);
    }

    const historicalData = await weatherService.getHistoricalWeather(
        parseFloat(lat),
        parseFloat(lon),
        new Date(startDate),
        new Date(endDate)
    );

    res.json({
        success: true,
        data: historicalData
    });
});

/**
 * @desc    Get weather risk assessment
 * @route   GET /api/weather/risk
 * @access  Private
 */
exports.getWeatherRisk = asyncHandler(async (req, res) => {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
        throw new ApiError('Latitude and longitude are required', 400);
    }

    const weather = await weatherService.getCurrentWeather(
        parseFloat(lat),
        parseFloat(lon)
    );

    const forecast = await weatherService.getForecast(
        parseFloat(lat),
        parseFloat(lon),
        3
    );

    // Calculate risk based on weather conditions
    let riskScore = 0;
    let riskFactors = [];

    // Heavy rainfall increases risk
    if (weather.precipitation > 50) {
        riskScore += 30;
        riskFactors.push('Heavy rainfall detected');
    } else if (weather.precipitation > 20) {
        riskScore += 15;
        riskFactors.push('Moderate rainfall');
    }

    // Check forecast for upcoming rain
    const upcomingRain = forecast.forecast?.some(day => day.precipitation > 20);
    if (upcomingRain) {
        riskScore += 20;
        riskFactors.push('Heavy rain forecasted');
    }

    // High humidity can indicate saturated soil
    if (weather.humidity > 85) {
        riskScore += 10;
        riskFactors.push('High humidity levels');
    }

    // Determine risk level
    let riskLevel;
    if (riskScore >= 50) {
        riskLevel = 'high';
    } else if (riskScore >= 30) {
        riskLevel = 'moderate';
    } else {
        riskLevel = 'low';
    }

    logger.info(`Weather risk assessment for [${lat}, ${lon}]: ${riskLevel} (${riskScore})`);

    res.json({
        success: true,
        risk: {
            level: riskLevel,
            score: riskScore,
            factors: riskFactors,
            weather,
            forecast: forecast.forecast?.slice(0, 3)
        }
    });
});

/**
 * @desc    Get all environmental data (weather, elevation, seismic)
 * @route   GET /api/weather/environmental
 * @access  Private
 */
exports.getEnvironmentalData = asyncHandler(async (req, res) => {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
        throw new ApiError('Latitude and longitude are required', 400);
    }

    const data = await weatherService.getAllEnvironmentalData(
        parseFloat(lat),
        parseFloat(lon)
    );

    res.json({
        success: true,
        data
    });
});

/**
 * @desc    Get elevation and slope data
 * @route   GET /api/weather/elevation
 * @access  Private
 */
exports.getElevation = asyncHandler(async (req, res) => {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
        throw new ApiError('Latitude and longitude are required', 400);
    }

    const elevation = await weatherService.getElevationData(
        parseFloat(lat),
        parseFloat(lon)
    );

    res.json({
        success: true,
        elevation
    });
});

/**
 * @desc    Get earthquake data
 * @route   GET /api/weather/seismic
 * @access  Private
 */
exports.getSeismicData = asyncHandler(async (req, res) => {
    const { lat, lon, radius = 100 } = req.query;

    if (!lat || !lon) {
        throw new ApiError('Latitude and longitude are required', 400);
    }

    const seismic = await weatherService.getEarthquakeData(
        parseFloat(lat),
        parseFloat(lon),
        parseInt(radius)
    );

    res.json({
        success: true,
        seismic
    });
});