const HistoricalIncident = require('../models/HistoricalIncident');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/async_handler');
const ApiError = require('../utils/api_error');
const landslideDataService = require('../services/landslideDataService');

/**
 * @desc    Get all historical incidents
 * @route   GET /api/incidents
 * @access  Private
 */
exports.getAllIncidents = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, severity, startDate, endDate, dynamic = false } = req.query;

    // If dynamic flag is set, fetch from real sources
    if (dynamic === 'true') {
        const incidents = await landslideDataService.getAllIncidents();

        let filtered = incidents;
        if (severity) {
            filtered = filtered.filter(i => i.severity === severity);
        }

        return res.json({
            success: true,
            source: 'dynamic',
            incidents: filtered,
            total: filtered.length
        });
    }

    // Otherwise fetch from database
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
        source: 'database',
        incidents,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        total: count
    });
});

/**
 * @desc    Get incidents from USGS source
 * @route   GET /api/incidents/source/usgs
 * @access  Public
 */
exports.getUSGSIncidents = asyncHandler(async (req, res) => {
    try {
        const usgsIncidents = await landslideDataService.fetchUSGSData();

        res.json({
            success: true,
            source: 'USGS',
            count: usgsIncidents.length,
            incidents: usgsIncidents
        });
    } catch (error) {
        logger.error(`Failed to fetch USGS incidents: ${error.message}`);
        throw new ApiError('Failed to fetch USGS incidents', 500);
    }
});

/**
 * @desc    Get incidents from GSI source
 * @route   GET /api/incidents/source/gsi
 * @access  Public
 */
exports.getGSIIncidents = asyncHandler(async (req, res) => {
    try {
        const gsiIncidents = await landslideDataService.fetchGSIData();

        res.json({
            success: true,
            source: 'GSI',
            count: gsiIncidents.length,
            incidents: gsiIncidents
        });
    } catch (error) {
        logger.error(`Failed to fetch GSI incidents: ${error.message}`);
        throw new ApiError('Failed to fetch GSI incidents', 500);
    }
});

/**
 * @desc    Get incidents from IIRS source
 * @route   GET /api/incidents/source/iirs
 * @access  Public
 */
exports.getIIRSIncidents = asyncHandler(async (req, res) => {
    try {
        const iirsIncidents = await landslideDataService.fetchIIRSData();

        res.json({
            success: true,
            source: 'IIRS',
            count: iirsIncidents.length,
            incidents: iirsIncidents
        });
    } catch (error) {
        logger.error(`Failed to fetch IIRS incidents: ${error.message}`);
        throw new ApiError('Failed to fetch IIRS incidents', 500);
    }
});

/**
 * @desc    Get incidents near a location (from dynamic sources)
 * @route   GET /api/incidents/nearby
 * @access  Private
 */
exports.getNearbyIncidents = asyncHandler(async (req, res) => {
    const { lat, lng, radius = 50, dynamic = false } = req.query;

    if (!lat || !lng) {
        throw new ApiError('Latitude and longitude are required', 400);
    }

    // If dynamic flag is set, fetch from real sources
    if (dynamic === 'true') {
        const incidents = await landslideDataService.getNearbyIncidents(parseFloat(lat), parseFloat(lng), parseFloat(radius));

        return res.json({
            success: true,
            source: 'dynamic',
            count: incidents.length,
            incidents
        });
    }

    // Otherwise fetch from database
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
        source: 'database',
        count: incidents.length,
        incidents
    });
});

// Synthetic incident generation removed - all data should come from official APIs

/**
 * @desc    Get dynamic incidents (DEPRECATED - removed)
 * Use /api/disasters/recent or /api/disasters/nearby instead
 */
exports.getDynamicIncidents = asyncHandler(async (req, res) => {
    throw new ApiError(
        'Dynamic incident generation removed. Use /api/disasters/recent or /api/disasters/nearby for real-time data.',
        410
    );
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

/**
 * @desc    Seed historical incidents dynamically from USGS, GSI, IIRS
 * @route   POST /api/incidents/seed-test
 * @access  Public
 */
exports.seedTestIncidents = asyncHandler(async (req, res) => {
    try {
        // Fetch dynamic incidents from real sources
        const dynamicIncidents = await landslideDataService.getAllIncidents();

        if (!dynamicIncidents || dynamicIncidents.length === 0) {
            throw new ApiError('No incidents fetched from sources', 500);
        }

        // Transform to database format with incidentDate field
        const formattedIncidents = dynamicIncidents.map(incident => ({
            ...incident,
            incidentDate: incident.date
        }));

        // Delete existing incidents to avoid duplicates
        await HistoricalIncident.deleteMany({});

        // Insert new dynamic incidents
        const result = await HistoricalIncident.insertMany(formattedIncidents);

        logger.info(`Seeded ${result.length} historical incidents from dynamic sources (USGS, GSI, IIRS)`);

        res.json({
            success: true,
            message: 'Historical incidents seeded successfully from dynamic sources',
            eventsCreated: result.length,
            sources: ['USGS', 'GSI', 'IIRS'],
            incidents: result.slice(0, 5) // Return first 5 for preview
        });
    } catch (error) {
        logger.error(`Failed to seed historical incidents: ${error.message}`);
        throw new ApiError('Failed to seed incidents', 500);
    }
});
