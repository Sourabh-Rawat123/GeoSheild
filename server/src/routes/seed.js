const express = require('express');
const router = express.Router();
const HistoricalIncident = require('../models/HistoricalIncident');
const { historicalIncidents } = require('../init/data');
const logger = require('../utils/logger');

// POST /api/seed/historical - Seed historical incidents (development only)
router.post('/historical', async (req, res) => {
    try {
        // Check if already seeded
        const count = await HistoricalIncident.countDocuments();

        if (count > 0) {
            return res.json({
                success: true,
                message: `Database already contains ${count} historical incidents`,
                count
            });
        }

        // Insert historical incidents
        const inserted = await HistoricalIncident.insertMany(historicalIncidents);

        logger.info(`Seeded ${inserted.length} historical incidents`);

        res.json({
            success: true,
            message: `Successfully seeded ${inserted.length} historical incidents`,
            count: inserted.length,
            incidents: inserted.map(i => i.toPublicJSON())
        });
    } catch (err) {
        logger.error(`Failed to seed historical incidents: ${err.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to seed data',
            message: err.message
        });
    }
});

// GET /api/seed/status - Check seed status
router.get('/status', async (req, res) => {
    try {
        const incidentCount = await HistoricalIncident.countDocuments();

        res.json({
            success: true,
            data: {
                historicalIncidents: incidentCount,
                seeded: incidentCount > 0
            }
        });
    } catch (err) {
        logger.error(`Failed to check seed status: ${err.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to check status'
        });
    }
});

module.exports = router;
