const mongoose = require('mongoose');
const User = require('../models/User');
const Prediction = require('../models/Prediction');
const HistoricalIncident = require('../models/HistoricalIncident');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/async_handler');
const ApiError = require('../utils/api_error');

/**
 * @desc    Get dashboard statistics (admin)
 * @route   GET /api/admin/dashboard
 * @access  Private/Admin
 */
exports.getDashboardStats = asyncHandler(async (req, res) => {
    const totalUsers = await User.countDocuments();
    const totalPredictions = await Prediction.countDocuments();
    const totalIncidents = await HistoricalIncident.countDocuments();

    const recentUsers = await User.find()
        .select('name email role createdAt')
        .sort({ createdAt: -1 })
        .limit(5);

    const usersByRole = await User.aggregate([
        {
            $group: {
                _id: '$role',
                count: { $sum: 1 }
            }
        }
    ]);

    const predictionsByRisk = await Prediction.aggregate([
        {
            $match: {
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            }
        },
        {
            $group: {
                _id: '$riskLevel',
                count: { $sum: 1 }
            }
        }
    ]);

    const incidentsBySeverity = await HistoricalIncident.aggregate([
        {
            $group: {
                _id: '$severity',
                count: { $sum: 1 }
            }
        }
    ]);

    res.json({
        success: true,
        stats: {
            overview: {
                totalUsers,
                totalPredictions,
                totalIncidents,
                activeUsers: totalUsers // Can be refined with last login tracking
            },
            users: {
                byRole: usersByRole,
                recent: recentUsers
            },
            predictions: {
                byRisk: predictionsByRisk,
                total30Days: predictionsByRisk.reduce((sum, item) => sum + item.count, 0)
            },
            incidents: {
                bySeverity: incidentsBySeverity
            }
        }
    });
});

/**
 * @desc    Get system health metrics
 * @route   GET /api/admin/health
 * @access  Private/Admin
 */
exports.getSystemHealth = asyncHandler(async (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    const memoryUsage = process.memoryUsage();

    res.json({
        success: true,
        health: {
            server: {
                status: 'operational',
                uptime: process.uptime(),
                memory: {
                    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
                    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
                    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
                },
                nodeVersion: process.version,
                platform: process.platform
            },
            database: {
                status: dbStatus,
                type: 'MongoDB'
            },
            timestamp: new Date().toISOString()
        }
    });
});

/**
 * @desc    Get activity logs
 * @route   GET /api/admin/logs
 * @access  Private/Admin
 */
exports.getActivityLogs = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, type } = req.query;

    // In production, implement actual log retrieval from database or log files
    // For now, return mock data
    const logs = [
        {
            id: '1',
            timestamp: new Date(),
            type: 'auth',
            action: 'login',
            user: 'user@example.com',
            details: 'User logged in successfully'
        },
        {
            id: '2',
            timestamp: new Date(Date.now() - 3600000),
            type: 'prediction',
            action: 'request',
            user: 'user@example.com',
            details: 'Prediction requested for location'
        }
    ];

    res.json({
        success: true,
        logs,
        total: logs.length,
        page: parseInt(page)
    });
});

/**
 * @desc    Bulk delete old data
 * @route   DELETE /api/admin/cleanup
 * @access  Private/SuperAdmin
 */
exports.cleanupOldData = asyncHandler(async (req, res) => {
    const { type, daysOld = 90 } = req.body;

    if (!type) {
        throw new ApiError('Type is required (predictions, logs)', 400);
    }

    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    if (type === 'predictions') {
        const result = await Prediction.deleteMany({ createdAt: { $lt: cutoffDate } });
        deletedCount = result.deletedCount;
    }

    logger.info(`Cleanup performed by admin: deleted ${deletedCount} ${type} older than ${daysOld} days`);

    res.json({
        success: true,
        message: `Deleted ${deletedCount} ${type} older than ${daysOld} days`,
        deletedCount
    });
});

/**
 * @desc    Update system settings
 * @route   PUT /api/admin/settings
 * @access  Private/SuperAdmin
 */
exports.updateSettings = asyncHandler(async (req, res) => {
    const settings = req.body;

    // In production, store settings in database
    logger.info(`System settings updated by admin ${req.user.id}`);

    res.json({
        success: true,
        message: 'Settings updated successfully',
        settings
    });
});

/**
 * @desc    Export data (CSV/JSON)
 * @route   GET /api/admin/export
 * @access  Private/Admin
 */
exports.exportData = asyncHandler(async (req, res) => {
    const { type, format = 'json' } = req.query;

    if (!type) {
        throw new ApiError('Type is required (users, predictions, incidents)', 400);
    }

    let data = [];

    switch (type) {
        case 'users':
            data = await User.find().select('-password').lean();
            break;
        case 'predictions':
            data = await Prediction.find().lean();
            break;
        case 'incidents':
            data = await HistoricalIncident.find().lean();
            break;
        default:
            throw new ApiError('Invalid type', 400);
    }

    if (format === 'json') {
        res.json({
            success: true,
            data,
            count: data.length
        });
    } else {
        // Implement CSV export
        throw new ApiError('CSV export not yet implemented', 501);
    }
});
