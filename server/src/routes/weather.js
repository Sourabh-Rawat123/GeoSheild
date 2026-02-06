const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const weatherController = require('../controllers/weatherController');
const logger = require('../utils/logger');

// Weather routes
router.get('/current', authMiddleware, weatherController.getCurrentWeather);
router.get('/forecast', authMiddleware, weatherController.getForecast);
router.get('/alerts', authMiddleware, weatherController.getWeatherAlerts);
router.get('/historical', authMiddleware, weatherController.getHistoricalWeather);
router.get('/risk', authMiddleware, weatherController.getWeatherRisk);


router.get('/environmental', authMiddleware, weatherController.getEnvironmentalData);
router.get('/elevation', authMiddleware, weatherController.getElevation);
router.get('/seismic', authMiddleware, weatherController.getSeismicData);

// GET /api/weather/rainfall-alert - Check rainfall alerts
router.get('/rainfall-alert', authMiddleware, async (req, res) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Latitude and longitude required' });
        }

        const alert = await weatherService.getRainfallAlert(
            parseFloat(lat),
            parseFloat(lon)
        );

        res.json({
            success: true,
            ...alert
        });
    } catch (err) {
        logger.error(`Rainfall alert error: ${err.message}`);
        res.status(500).json({ error: 'Failed to check rainfall alerts' });
    }
});

module.exports = router;
