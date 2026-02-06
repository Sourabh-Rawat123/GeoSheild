const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const incidentController = require('../controllers/incidentController');

// Public routes (require authentication)
router.get('/', authMiddleware, incidentController.getAllIncidents);
router.get('/nearby', authMiddleware, incidentController.getNearbyIncidents);
router.get('/stats', authMiddleware, incidentController.getIncidentStats);
router.get('/:id', authMiddleware, incidentController.getIncidentById);

// Admin routes
router.post('/', authMiddleware, roleMiddleware('admin', 'super_admin'), incidentController.createIncident);
router.put('/:id', authMiddleware, roleMiddleware('admin', 'super_admin'), incidentController.updateIncident);
router.delete('/:id', authMiddleware, roleMiddleware('admin', 'super_admin'), incidentController.deleteIncident);

module.exports = router;
