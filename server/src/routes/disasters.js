/**
 * Unified Disaster API Routes
 * Combines NASA EONET + ReliefWeb data
 */
const express = require('express');
const router = express.Router();
const unifiedDisasterService = require('../services/unifiedDisasterService');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/async_handler');
const ApiError = require('../utils/api_error');
const RealTimeEvent = require('../models/RealTimeEvent');

/**
 * Sync both NASA EONET + ReliefWeb
 * POST /api/disasters/sync
 */
router.post('/sync', asyncHandler(async (req, res) => {
    const result = await unifiedDisasterService.syncUnified();

    if (!result.success) {
        throw new ApiError(`Sync failed: ${result.error}`, 500);
    }

    res.json({
        success: true,
        message: 'Unified disaster sync completed',
        data: result
    });
}));

/**
 * Get incidents by source priority
 * GET /api/disasters/prioritized
 * Priority: ReliefWeb (60%) > NASA EONET (40%)
 */
router.get('/prioritized', asyncHandler(async (req, res) => {
    const { days = 30, limit = 50 } = req.query;

    const incidents = await unifiedDisasterService.getIncidentsByPriority(
        parseInt(days),
        parseInt(limit)
    );

    if (incidents.error) {
        throw new ApiError('Failed to fetch incidents', 500);
    }

    res.json({
        success: true,
        strategy: 'Prioritized (ReliefWeb 60% > NASA EONET 40%)',
        days: parseInt(days),
        data: {
            reliefweb: incidents.reliefweb.length,
            nasa: incidents.nasa.length,
            total: incidents.total,
            events: incidents.reliefweb.concat(incidents.nasa)
        }
    });
}));

/**
 * Get scheduler status and health
 * GET /api/disasters/health
 */
router.get('/health', asyncHandler(async (req, res) => {
    const unifiedDisasterScheduler = require('../services/unifiedDisasterScheduler');

    res.json({
        success: true,
        scheduler: unifiedDisasterScheduler.getStatus(),
        timestamp: new Date()
    });
}));

/**
 * Get analytics dashboard data
 * GET /api/disasters/analytics
 */
router.get('/analytics', asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - parseInt(days));

    // Overall statistics
    const totalEvents = await RealTimeEvent.countDocuments();
    const recentEvents = await RealTimeEvent.countDocuments({
        eventDate: { $gte: dateFrom }
    });

    // By severity
    const bySeverity = await RealTimeEvent.aggregate([
        { $match: { eventDate: { $gte: dateFrom } } },
        {
            $group: {
                _id: '$severity',
                count: { $sum: 1 }
            }
        }
    ]);

    // By source
    const bySource = await RealTimeEvent.aggregate([
        { $match: { eventDate: { $gte: dateFrom } } },
        {
            $group: {
                _id: '$source',
                count: { $sum: 1 }
            }
        }
    ]);

    // Time series (daily count)
    const timeSeries = await RealTimeEvent.aggregate([
        { $match: { eventDate: { $gte: dateFrom } } },
        {
            $group: {
                _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$eventDate' }
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    res.json({
        success: true,
        period: `Last ${days} days`,
        stats: {
            total: totalEvents,
            recent: recentEvents,
            bySeverity,
            bySource,
            timeSeries
        }
    });
}));

/**
 * Get events by severity level (for alerts)
 * GET /api/disasters/by-severity/:severity
 */
router.get('/by-severity/:severity', asyncHandler(async (req, res) => {
    const { severity } = req.params;
    const { days = 30, limit = 100 } = req.query;

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - parseInt(days));

    const events = await RealTimeEvent.find({
        severity,
        eventDate: { $gte: dateFrom }
    })
        .sort({ eventDate: -1 })
        .limit(parseInt(limit))
        .lean();

    res.json({
        success: true,
        severity,
        count: events.length,
        events
    });
}));

/**
 * Get events near location (geographic query)
 * GET /api/disasters/nearby?lat=27.0410&lon=88.2636&radius=100
 */
router.get('/nearby', asyncHandler(async (req, res) => {
    const { lat, lon, radius = 100, days = 30 } = req.query;

    if (!lat || !lon) {
        throw new ApiError('Latitude and longitude required', 400);
    }

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - parseInt(days));

    const events = await RealTimeEvent.find({
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(lon), parseFloat(lat)]
                },
                $maxDistance: parseFloat(radius) * 1000
            }
        },
        eventDate: { $gte: dateFrom }
    })
        .sort({ eventDate: -1 })
        .lean();

    res.json({
        success: true,
        location: { latitude: parseFloat(lat), longitude: parseFloat(lon) },
        radius: `${radius}km`,
        count: events.length,
        events
    });
}));

/**
 * Manual trigger sync endpoint
 * POST /api/disasters/sync-now
 */
router.post('/sync-now', asyncHandler(async (req, res) => {
    const unifiedDisasterScheduler = require('../services/unifiedDisasterScheduler');

    logger.info('🔔 Manual sync triggered via API');
    const result = await unifiedDisasterScheduler.syncNow();

    res.json({
        success: true,
        message: 'Manual sync initiated',
        result
    });
}));

/**
 * Get error/failure statistics
 * GET /api/disasters/errors?hours=24
 */
router.get('/errors', asyncHandler(async (req, res) => {
    const errorHandler = require('../utils/errorHandler');
    const { hours = 24 } = req.query;

    const stats = errorHandler.getFailureStats(parseInt(hours));
    const nasaHealth = errorHandler.getRecoveryRecommendations('NASA_EONET');
    const reliefwebHealth = errorHandler.getRecoveryRecommendations('ReliefWeb');

    res.json({
        success: true,
        failureStats: stats,
        recommendations: {
            nasaEonet: nasaHealth,
            reliefweb: reliefwebHealth
        }
    });
}));

module.exports = router;
