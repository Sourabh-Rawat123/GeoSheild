const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const alertController = require('../controllers/alertController');

// Alert routes
router.get('/', authMiddleware, alertController.getAlerts);
router.post('/test', authMiddleware, alertController.sendTestAlert);
router.post('/create', authMiddleware, alertController.createAlert);
router.put('/:id/read', authMiddleware, alertController.markAlertAsRead);
router.delete('/:id', authMiddleware, alertController.deleteAlert);

// Alert preferences
router.get('/preferences', authMiddleware, alertController.getAlertPreferences);
router.put('/preferences', authMiddleware, alertController.updateAlertPreferences);

// Alert statistics
router.get('/stats', authMiddleware, alertController.getAlertStats);

module.exports = router;
