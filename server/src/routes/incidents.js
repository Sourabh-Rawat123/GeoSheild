const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const incidentController = require('../controllers/incidentController');

// Public routes (require authentication)
router.get('/', authMiddleware, incidentController.getAllIncidents);
router.get('/nearby', authMiddleware, incidentController.getNearbyIncidents);
router.get('/dynamic', incidentController.getDynamicIncidents);
router.get('/stats', authMiddleware, incidentController.getIncidentStats);
router.get('/:id', authMiddleware, incidentController.getIncidentById);

// Source-specific dynamic routes (public access to real data)
router.get('/source/usgs', incidentController.getUSGSIncidents);
router.get('/source/gsi', incidentController.getGSIIncidents);
router.get('/source/iirs', incidentController.getIIRSIncidents);

// Seed test incidents (for demo)
router.post('/seed-test', incidentController.seedTestIncidents);

// Admin routes
router.post('/', authMiddleware, roleMiddleware('admin', 'super_admin'), incidentController.createIncident);
router.put('/:id', authMiddleware, roleMiddleware('admin', 'super_admin'), incidentController.updateIncident);
router.delete('/:id', authMiddleware, roleMiddleware('admin', 'super_admin'), incidentController.deleteIncident);

module.exports = router;
