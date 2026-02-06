const HistoricalIncident = require('../models/HistoricalIncident');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/async_handler');
const ApiError = require('../utils/api_error');

/**
 * @desc    Get all historical incidents
 * @route   GET /api/incidents
 * @access  Private
 */
exports.getAllIncidents = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, severity, startDate, endDate } = req.query;

    const query = {};

    // Filter by severity
    if (severity) {
        query.severity = severity;
    }

    // Filter by date range
    if (startDate && endDate) {
        query.date = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }

    const incidents = await HistoricalIncident.find(query)
        .sort({ date: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const count = await HistoricalIncident.countDocuments(query);

    res.json({
        success: true,
        incidents,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        total: count
    });
});

/**
 * @desc    Get incidents near a location
 * @route   GET /api/incidents/nearby
 * @access  Private
 */
exports.getNearbyIncidents = asyncHandler(async (req, res) => {
    const { lat, lng, radius = 50 } = req.query;

    if (!lat || !lng) {
        throw new ApiError('Latitude and longitude are required', 400);
    }

    const incidents = await HistoricalIncident.find({
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                },
                $maxDistance: radius * 1000 // Convert km to meters
            }
        }
    }).limit(100);

    res.json({
        success: true,
        count: incidents.length,
        incidents
    });
});

/**
 * @desc    Get incident by ID
 * @route   GET /api/incidents/:id
 * @access  Private
 */
exports.getIncidentById = asyncHandler(async (req, res) => {
    const incident = await HistoricalIncident.findById(req.params.id);

    if (!incident) {
        throw new ApiError('Incident not found', 404);
    }

    res.json({
        success: true,
        incident
    });
});

/**
 * @desc    Create new incident
 * @route   POST /api/incidents
 * @access  Private/Admin
 */
exports.createIncident = asyncHandler(async (req, res) => {
    const { latitude, longitude, date, severity, description, casualties, damage } = req.body;

    if (!latitude || !longitude || !date) {
        throw new ApiError('Latitude, longitude, and date are required', 400);
    }

    const incident = new HistoricalIncident({
        location: {
            type: 'Point',
            coordinates: [longitude, latitude]
        },
        date: new Date(date),
        severity,
        description,
        casualties,
        damage,
        reportedBy: req.user.id
    });

    await incident.save();

    logger.info(`New incident created at [${latitude}, ${longitude}] by user ${req.user.id}`);

    res.status(201).json({
        success: true,
        incident
    });
});

/**
 * @desc    Update incident
 * @route   PUT /api/incidents/:id
 * @access  Private/Admin
 */
exports.updateIncident = asyncHandler(async (req, res) => {
    const incident = await HistoricalIncident.findById(req.params.id);

    if (!incident) {
        throw new ApiError('Incident not found', 404);
    }

    const allowedUpdates = ['severity', 'description', 'casualties', 'damage', 'verified'];
    const updates = req.body;

    Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
            incident[key] = updates[key];
        }
    });

    await incident.save();

    logger.info(`Incident ${req.params.id} updated by user ${req.user.id}`);

    res.json({
        success: true,
        incident
    });
});

/**
 * @desc    Delete incident
 * @route   DELETE /api/incidents/:id
 * @access  Private/Admin
 */
exports.deleteIncident = asyncHandler(async (req, res) => {
    const incident = await HistoricalIncident.findById(req.params.id);

    if (!incident) {
        throw new ApiError('Incident not found', 404);
    }

    await incident.deleteOne();

    logger.info(`Incident ${req.params.id} deleted by user ${req.user.id}`);

    res.json({
        success: true,
        message: 'Incident deleted successfully'
    });
});

/**
 * @desc    Get incident statistics
 * @route   GET /api/incidents/stats
 * @access  Private
 */
exports.getIncidentStats = asyncHandler(async (req, res) => {
    const totalIncidents = await HistoricalIncident.countDocuments();

    const bySeverity = await HistoricalIncident.aggregate([
        {
            $group: {
                _id: '$severity',
                count: { $sum: 1 }
            }
        }
    ]);

    const recentIncidents = await HistoricalIncident.find()
        .sort({ date: -1 })
        .limit(10);

    const byYear = await HistoricalIncident.aggregate([
        {
            $group: {
                _id: { $year: '$date' },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: -1 } }
    ]);

    res.json({
        success: true,
        stats: {
            total: totalIncidents,
            bySeverity,
            byYear,
            recent: recentIncidents
        }
    });
});
