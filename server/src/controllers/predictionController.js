const Prediction = require('../models/Prediction');
const HistoricalIncident = require('../models/HistoricalIncident');
const Alert = require('../models/Alert');
const User = require('../models/User');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/async_handler');
const ApiError = require('../utils/api_error');
const integratedMLService = require('../services/integratedMLService');

/**
 * Create alert if prediction meets user's severity threshold
 */
async function createAlertIfNeeded(prediction, userId, latitude, longitude) {
    try {
        const user = await User.findById(userId);
        if (!user || !user.alertPreferences) return;

        const severityLevels = { 'LOW': 1, 'MODERATE': 2, 'HIGH': 3, 'CRITICAL': 4 };
        const predictionLevel = severityLevels[prediction.riskLevel] || 0;
        const thresholdLevel = severityLevels[user.alertPreferences.severityThreshold?.toUpperCase()] || 2;

        // Only create alert if prediction meets or exceeds threshold
        if (predictionLevel >= thresholdLevel) {
            const alert = new Alert({
                userId: userId,
                timestamp: new Date(),
                severity: prediction.riskLevel,
                location: {
                    type: 'Point',
                    coordinates: [longitude, latitude],
                    address: user.location?.address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                },
                message: `${prediction.riskLevel} landslide risk detected (${(prediction.probability * 100).toFixed(1)}% probability) in your monitored area`,
                sentVia: [],
                read: false,
                details: {
                    probability: prediction.probability,
                    riskLevel: prediction.riskLevel,
                    confidence: prediction.confidence
                }
            });

            // Determine which channels to send via
            if (user.alertPreferences.sms?.enabled) {
                alert.sentVia.push('sms');
            }
            // Email is enabled by default in schema
            alert.sentVia.push('email');

            await alert.save();
            logger.info(`Alert created for user ${userId}: ${prediction.riskLevel} risk at [${latitude}, ${longitude}]`);
        }
    } catch (error) {
        logger.error(`Failed to create alert: ${error.message}`);
    }
}

/**
 * @desc    Get integrated prediction (50% API + 40% ML + 10% Historical)
 * @route   POST /api/predictions
 * @access  Private
 */
exports.getPrediction = asyncHandler(async (req, res) => {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
        throw new ApiError('Latitude and longitude are required', 400);
    }

    // Get integrated prediction (ML runs in backend process)
    const result = await integratedMLService.predict(latitude, longitude);

    // Store prediction in database
    const storedPrediction = new Prediction({
        userId: req.user.id,
        location: {
            type: 'Point',
            coordinates: [longitude, latitude]
        },
        prediction: {
            riskLevel: result.prediction.riskLevel,
            probability: result.prediction.probability,
            confidence: result.prediction.confidence
        },
        features: {
            // Map from result.breakdown to prediction features
            slope: result.breakdown?.api?.slope || 0,
            elevation: result.breakdown?.api?.elevation || 0,
            rainfall: result.breakdown?.api?.rainfall_24h || 0
        },
        weather: {
            currentRainfall: result.breakdown?.api?.rainfall_24h || 0,
            forecast24h: result.breakdown?.api?.rainfall_24h || 0,
            forecast72h: result.breakdown?.api?.rainfall_72h || 0,
            temperature: result.breakdown?.api?.temperature || 0,
            humidity: result.breakdown?.api?.humidity || 0,
            windSpeed: result.breakdown?.api?.wind_speed || 0
        },
        mlModel: {
            name: 'ensemble',
            version: '1.0'
        }
    });

    await storedPrediction.save();

    // Create alert if risk is high enough
    await createAlertIfNeeded(result.prediction, req.user.id, latitude, longitude);

    logger.info(`Integrated prediction for [${latitude}, ${longitude}]: ${result.prediction.riskLevel} (${(result.prediction.probability * 100).toFixed(1)}%)`);

    res.json({
        success: true,
        prediction: {
            id: storedPrediction._id,
            ...result.prediction
        },
        breakdown: result.breakdown,
        metadata: result.metadata
    });
});

/**
 * @desc    Get batch predictions
 * @route   POST /api/predictions/batch
 * @access  Private
 */
exports.getBatchPredictions = asyncHandler(async (req, res) => {
    const { locations } = req.body;

    if (!locations || !Array.isArray(locations) || locations.length === 0) {
        throw new ApiError('Locations array is required', 400);
    }

    if (locations.length > 100) {
        throw new ApiError('Maximum 100 locations allowed per batch', 400);
    }

    // Process batch predictions using integrated ML
    const predictions = await Promise.all(
        locations.map(async (loc) => {
            try {
                const result = await integratedMLService.predict(loc.latitude, loc.longitude);
                return {
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    ...result.prediction
                };
            } catch (error) {
                logger.error(`Batch prediction failed for [${loc.latitude}, ${loc.longitude}]`, error);
                return {
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    error: error.message
                };
            }
        })
    );

    logger.info(`Batch prediction completed for ${locations.length} locations by user ${req.user.id}`);

    res.json({
        success: true,
        count: predictions.length,
        predictions
    });
});

/**
 * @desc    Store prediction result
 * @route   POST /api/predictions/store
 * @access  Private
 */
exports.storePrediction = asyncHandler(async (req, res) => {
    const { latitude, longitude, riskLevel, probability, features, metadata } = req.body;

    if (!latitude || !longitude || !riskLevel || probability === undefined) {
        throw new ApiError('Missing required fields', 400);
    }

    const prediction = new Prediction({
        location: {
            type: 'Point',
            coordinates: [longitude, latitude]
        },
        riskLevel,
        probability,
        features,
        metadata,
        userId: req.user.id
    });

    await prediction.save();

    logger.info(`Prediction stored for [${latitude}, ${longitude}]`);

    res.status(201).json({
        success: true,
        prediction
    });
});

/**
 * @desc    Get active predictions for map display
 * @route   GET /api/predictions/active
 * @access  Private
 */
exports.getActivePredictions = asyncHandler(async (req, res) => {
    const { bounds, riskLevel, limit = 100 } = req.query;

    const query = {
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    };

    // Filter by risk level
    if (riskLevel) {
        query.riskLevel = riskLevel;
    }

    // Filter by bounds if provided
    if (bounds) {
        const [minLng, minLat, maxLng, maxLat] = bounds.split(',').map(Number);
        query.location = {
            $geoWithin: {
                $box: [
                    [minLng, minLat],
                    [maxLng, maxLat]
                ]
            }
        };
    }

    const predictions = await Prediction.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

    res.json({
        success: true,
        count: predictions.length,
        predictions
    });
});

/**
 * @desc    Get predictions near a location
 * @route   GET /api/predictions/nearby
 * @access  Private
 */
exports.getNearbyPredictions = asyncHandler(async (req, res) => {
    const { lat, lng, radius = 10 } = req.query;

    if (!lat || !lng) {
        throw new ApiError('Latitude and longitude are required', 400);
    }

    const predictions = await Prediction.find({
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                },
                $maxDistance: radius * 1000 // Convert km to meters
            }
        },
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).limit(50);

    res.json({
        success: true,
        count: predictions.length,
        predictions
    });
});

/**
 * @desc    Get prediction by ID
 * @route   GET /api/predictions/:id
 * @access  Private
 */
exports.getPredictionById = asyncHandler(async (req, res) => {
    const prediction = await Prediction.findById(req.params.id);

    if (!prediction) {
        throw new ApiError('Prediction not found', 404);
    }

    res.json({
        success: true,
        prediction
    });
});

/**
 * @desc    Delete old predictions
 * @route   DELETE /api/predictions/cleanup
 * @access  Private/Admin
 */
exports.cleanupOldPredictions = asyncHandler(async (req, res) => {
    const { daysOld = 7 } = req.query;

    const result = await Prediction.deleteMany({
        createdAt: { $lt: new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000) }
    });

    logger.info(`Cleaned up ${result.deletedCount} old predictions`);

    res.json({
        success: true,
        deletedCount: result.deletedCount,
        message: `Deleted predictions older than ${daysOld} days`
    });
});

/**
 * @desc    Get prediction statistics
 * @route   GET /api/predictions/stats
 * @access  Private
 */
exports.getPredictionStats = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    const matchQuery = {};
    if (startDate && endDate) {
        matchQuery.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }

    const stats = await Prediction.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: '$riskLevel',
                count: { $sum: 1 },
                avgProbability: { $avg: '$probability' }
            }
        }
    ]);

    const totalCount = await Prediction.countDocuments(matchQuery);

    res.json({
        success: true,
        total: totalCount,
        byRiskLevel: stats
    });
});

/**
 * @desc    Get route analysis
 * @route   POST /api/predictions/route
 * @access  Private
 */
exports.analyzeRoute = asyncHandler(async (req, res) => {
    const { waypoints } = req.body;

    if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
        throw new ApiError('At least 2 waypoints are required', 400);
    }

    // Generate points along the route (simplified)
    const routePoints = waypoints.map(wp => ({
        latitude: wp.lat,
        longitude: wp.lng
    }));

    // Use integrated ML service for batch prediction
    const predictions = await Promise.all(
        routePoints.map(async (point) => {
            try {
                const result = await integratedMLService.predict(point.latitude, point.longitude);
                return {
                    latitude: point.latitude,
                    longitude: point.longitude,
                    probability: result.prediction.probability,
                    riskLevel: result.prediction.riskLevel
                };
            } catch (error) {
                logger.error(`Route point prediction failed for [${point.latitude}, ${point.longitude}]`, error);
                return {
                    latitude: point.latitude,
                    longitude: point.longitude,
                    probability: 0,
                    riskLevel: 'UNKNOWN'
                };
            }
        })
    );

    // Analyze risk along route
    const maxRisk = Math.max(...predictions.map(p => p.probability || 0));
    const avgRisk = predictions.reduce((sum, p) => sum + (p.probability || 0), 0) / predictions.length;

    const highRiskSegments = predictions.filter(p => (p.probability || 0) > 70);

    logger.info(`Route analysis completed for ${waypoints.length} waypoints by user ${req.user.id}`);

    res.json({
        success: true,
        analysis: {
            totalPoints: predictions.length,
            maxRisk,
            avgRisk,
            highRiskCount: highRiskSegments.length,
            predictions,
            recommendation: maxRisk > 70 ? 'High risk route - consider alternative' : 'Route appears safe'
        }
    });
});
