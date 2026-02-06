const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const predictionController = require('../controllers/predictionController');
const HistoricalIncident = require('../models/HistoricalIncident');
const Prediction = require('../models/Prediction');
const logger = require('../utils/logger');

// Main prediction route (50% API + 40% ML + 10% Historical) - ML runs in backend
router.post('/', authMiddleware, predictionController.getPrediction);

// Batch prediction route
router.post('/batch', authMiddleware, predictionController.getBatchPredictions);
router.post('/store', authMiddleware, predictionController.storePrediction);
router.post('/route', authMiddleware, predictionController.analyzeRoute);

// GET routes - IMPORTANT: specific routes BEFORE /:id to prevent route matching issues
router.get('/active', authMiddleware, predictionController.getActivePredictions);
router.get('/nearby', authMiddleware, predictionController.getNearbyPredictions);
router.get('/stats', authMiddleware, predictionController.getPredictionStats);

// Admin routes
router.delete('/cleanup', authMiddleware, roleMiddleware('admin', 'super_admin'), predictionController.cleanupOldPredictions);

// GET /api/predictions/risk-zones - Get risk heatmap
router.get('/risk-zones', authMiddleware, async (req, res) => {
    try {
        const { min_lat, min_lon, max_lat, max_lon, resolution = 50 } = req.query;

        if (!min_lat || !min_lon || !max_lat || !max_lon) {
            return res.status(400).json({
                error: 'Bounding box coordinates required (min_lat, min_lon, max_lat, max_lon)'
            });
        }

        // Generate grid points within bounding box
        const latStep = (max_lat - min_lat) / resolution;
        const lonStep = (max_lon - min_lon) / resolution;
        const gridPoints = [];

        for (let lat = parseFloat(min_lat); lat <= parseFloat(max_lat); lat += latStep) {
            for (let lon = parseFloat(min_lon); lon <= parseFloat(max_lon); lon += lonStep) {
                gridPoints.push({ latitude: lat, longitude: lon });
            }
        }

        // Limit to reasonable number of points
        const maxPoints = 500;
        if (gridPoints.length > maxPoints) {
            const step = Math.ceil(gridPoints.length / maxPoints);
            gridPoints = gridPoints.filter((_, index) => index % step === 0);
        }

        logger.info(`Generating risk zones for ${gridPoints.length} points`);

        // Get predictions for grid using integrated ML service
        const integratedMLService = require('../services/integratedMLService');
        const predictions = await Promise.all(
            gridPoints.map(async (point) => {
                try {
                    const result = await integratedMLService.predict(point.latitude, point.longitude);
                    return {
                        latitude: point.latitude,
                        longitude: point.longitude,
                        risk: result.prediction.probability,
                        level: result.prediction.riskLevel
                    };
                } catch (error) {
                    return {
                        latitude: point.latitude,
                        longitude: point.longitude,
                        risk: 0,
                        level: 'UNKNOWN'
                    };
                }
            })
        );

        logger.info(`Risk zones generated for user ${req.user.id}`);

        res.json({
            success: true,
            zones: predictions,
            count: predictions.length
        });
    } catch (err) {
        logger.error(`Risk zones error: ${err.message}`);
        res.status(500).json({ error: 'Failed to generate risk zones' });
    }
});

// GET /api/predictions/active - Get active predictions for map
router.get('/active', authMiddleware, async (req, res) => {
    try {
        const { lat, lon, radius } = req.query;

        let query = { status: 'active', validUntil: { $gt: new Date() } };

        // If location provided, find nearby predictions
        if (lat && lon) {
            const radiusKm = parseFloat(radius) || 50;
            query.location = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(lon), parseFloat(lat)]
                    },
                    $maxDistance: radiusKm * 1000
                }
            };
        }

        const predictions = await Prediction.find(query)
            .sort({ 'prediction.probability': -1 })
            .limit(100);

        res.json({
            success: true,
            count: predictions.length,
            predictions: predictions.map(p => p.toPublicJSON())
        });
    } catch (err) {
        logger.error(`Failed to fetch active predictions: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch predictions' });
    }
});

// POST /api/predictions/store - Store prediction result
router.post('/store', authMiddleware, async (req, res) => {
    try {
        const { location, prediction, features, weather } = req.body;

        const newPrediction = new Prediction({
            userId: req.user.id,
            location,
            prediction,
            features,
            weather,
            mlModel: {
                name: 'ensemble',
                version: '1.0'
            }
        });

        await newPrediction.save();

        logger.info(`Prediction stored for user ${req.user.id} at [${location.coordinates}]`);

        res.json({
            success: true,
            prediction: newPrediction.toPublicJSON()
        });
    } catch (err) {
        logger.error(`Failed to store prediction: ${err.message}`);
        res.status(500).json({ error: 'Failed to store prediction' });
    }
});

// GET /api/predictions/historical - Get historical incidents
router.get('/historical', authMiddleware, async (req, res) => {
    try {
        const { lat, lon, radius, months } = req.query;
        console.log('Historical incidents request:', { lat, lon, radius, months });

        let incidents;

        if (lat && lon) {
            const radiusKm = parseFloat(radius) || 100;
            incidents = await HistoricalIncident.findNearby(
                parseFloat(lon),
                parseFloat(lat),
                radiusKm
            );
            console.log(`Found ${incidents.length} incidents within ${radiusKm}km of [${lat}, ${lon}]`);

            // If no incidents found nearby, return all incidents for demo purposes
            if (incidents.length === 0) {
                console.log('No nearby incidents found, returning all incidents');
                incidents = await HistoricalIncident.find({ verified: true })
                    .sort({ incidentDate: -1 })
                    .limit(50);
                console.log(`Returning ${incidents.length} total incidents`);
            }
        } else if (months) {
            incidents = await HistoricalIncident.findRecent(parseInt(months));
        } else {
            incidents = await HistoricalIncident.find({ verified: true })
                .sort({ incidentDate: -1 })
                .limit(50);
        }

        res.json({
            success: true,
            count: incidents.length,
            incidents: incidents.map(i => i.toPublicJSON())
        });
    } catch (err) {
        logger.error(`Failed to fetch historical incidents: ${err.message}`);
        logger.error(`Error stack: ${err.stack}`);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch historical data',
            message: err.message
        });
    }
});

// POST /api/predictions/historical - Report new incident
router.post('/historical', authMiddleware, async (req, res) => {
    try {
        const incidentData = {
            ...req.body,
            reportedBy: req.user.id,
            verified: req.user.role === 'admin'
        };

        const incident = new HistoricalIncident(incidentData);
        await incident.save();

        logger.info(`Historical incident reported by user ${req.user.id}`);

        res.json({
            success: true,
            incident: incident.toPublicJSON()
        });
    } catch (err) {
        logger.error(`Failed to report incident: ${err.message}`);
        res.status(500).json({ error: 'Failed to report incident' });
    }
});

// GET /api/predictions/:id - MUST be last to avoid matching specific routes
router.get('/:id', authMiddleware, predictionController.getPredictionById);

module.exports = router;
