const logger = require('../utils/logger');
const asyncHandler = require('../utils/async_handler');
const ApiError = require('../utils/api_error');
const alertService = require('../services/alertService');
const Alert = require('../models/Alert');
const User = require('../models/User');

/**
 * @desc    Get user's alert history
 * @route   GET /api/alerts
 * @access  Private
 */
exports.getAlerts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, severity, unreadOnly } = req.query;

    const query = { userId: req.user.id };

    if (severity) {
        query.severity = severity.toUpperCase();
    }

    if (unreadOnly === 'true') {
        query.read = false;
    }

    const alerts = await Alert.find(query)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .lean();

    const total = await Alert.countDocuments(query);

    // Transform for frontend compatibility
    const transformedAlerts = alerts.map(alert => ({
        id: alert._id.toString(),
        userId: alert.userId.toString(),
        timestamp: alert.timestamp,
        severity: alert.severity,
        location: {
            latitude: alert.location.coordinates[1],
            longitude: alert.location.coordinates[0],
            address: alert.location.address
        },
        message: alert.message,
        sent_via: alert.sentVia,
        read: alert.read,
        details: alert.details
    }));

    res.json({
        success: true,
        count: transformedAlerts.length,
        total,
        page: parseInt(page),
        alerts: transformedAlerts
    });
});

/**
 * @desc    Send test alert
 * @route   POST /api/alerts/test
 * @access  Private
 */
exports.sendTestAlert = asyncHandler(async (req, res) => {
    const { channel, message } = req.body;

    if (!channel) {
        throw new ApiError('Channel is required (email, sms, whatsapp)', 400);
    }

    const validChannels = ['email', 'sms', 'whatsapp'];
    if (!validChannels.includes(channel)) {
        throw new ApiError('Invalid channel. Use: email, sms, or whatsapp', 400);
    }

    // Send test alert
    const alertMessage = message || 'This is a test alert from GeoShield AI';

    try {
        // In production, implement actual alert sending
        logger.info(`Test alert sent via ${channel} to user ${req.user.email}`);

        res.json({
            success: true,
            message: `Test alert sent successfully via ${channel}`,
            timestamp: new Date()
        });
    } catch (error) {
        logger.error(`Failed to send test alert: ${error.message}`);
        throw new ApiError('Failed to send test alert', 500);
    }
});

/**
 * @desc    Create alert for high-risk prediction
 * @route   POST /api/alerts/create
 * @access  Private
 */
exports.createAlert = asyncHandler(async (req, res) => {
    const { predictionId, location, severity, message } = req.body;

    if (!location || !severity || !message) {
        throw new ApiError('Location, severity, and message are required', 400);
    }

    // Create alert record
    const alert = {
        id: Date.now().toString(),
        userId: req.user.id,
        predictionId,
        timestamp: new Date(),
        severity,
        location,
        message,
        sentVia: [],
        read: false
    };

    // Get user's alert preferences
    const userPreferences = req.user.alertPreferences || {
        email: true,
        sms: false,
        whatsapp: false
    };

    // Send alerts via preferred channels
    const sentChannels = [];
    if (userPreferences.email) {
        // Send email alert (implement in production)
        sentChannels.push('email');
    }
    if (userPreferences.sms) {
        // Send SMS alert (implement in production)
        sentChannels.push('sms');
    }
    if (userPreferences.whatsapp) {
        // Send WhatsApp alert (implement in production)
        sentChannels.push('whatsapp');
    }

    alert.sentVia = sentChannels;

    logger.info(`Alert created for user ${req.user.id}: ${severity} severity`);

    res.status(201).json({
        success: true,
        alert
    });
});

/**
 * @desc    Mark alert as read
 * @route   PUT /api/alerts/:id/read
 * @access  Private
 */
exports.markAlertAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // In production, update database
    logger.info(`Alert ${id} marked as read by user ${req.user.id}`);

    res.json({
        success: true,
        message: 'Alert marked as read'
    });
});

/**
 * @desc    Delete alert
 * @route   DELETE /api/alerts/:id
 * @access  Private
 */
exports.deleteAlert = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // In production, delete from database
    logger.info(`Alert ${id} deleted by user ${req.user.id}`);

    res.json({
        success: true,
        message: 'Alert deleted successfully'
    });
});

/**
 * @desc    Get alert preferences
 * @route   GET /api/alerts/preferences
 * @access  Private
 */
exports.getAlertPreferences = asyncHandler(async (req, res) => {
    const preferences = req.user.alertPreferences || {
        email: true,
        sms: false,
        whatsapp: false,
        threshold: 'moderate'
    };

    res.json({
        success: true,
        preferences
    });
});

/**
 * @desc    Update alert preferences
 * @route   PUT /api/alerts/preferences
 * @access  Private
 */
exports.updateAlertPreferences = asyncHandler(async (req, res) => {
    const { email, sms, whatsapp, threshold } = req.body;

    const preferences = {
        email: email !== undefined ? email : true,
        sms: sms !== undefined ? sms : false,
        whatsapp: whatsapp !== undefined ? whatsapp : false,
        threshold: threshold || 'moderate'
    };

    // In production, update user preferences in database
    logger.info(`Alert preferences updated for user ${req.user.id}`);

    res.json({
        success: true,
        preferences,
        message: 'Alert preferences updated successfully'
    });
});

/**
 * @desc    Get alert statistics
 * @route   GET /api/alerts/stats
 * @access  Private
 */
exports.getAlertStats = asyncHandler(async (req, res) => {
    // Mock statistics
    const stats = {
        total: 15,
        unread: 3,
        bySeverity: {
            high: 5,
            moderate: 7,
            low: 3
        },
        byChannel: {
            email: 15,
            sms: 8,
            whatsapp: 2
        },
        last7Days: 7,
        last30Days: 15
    };

    res.json({
        success: true,
        stats
    });
});
