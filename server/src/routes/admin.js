const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// All routes require admin or super_admin role
router.use(authMiddleware);
router.use(roleMiddleware('admin', 'super_admin'));

// Dashboard and statistics
router.get('/dashboard', adminController.getDashboardStats);
router.get('/health', adminController.getSystemHealth);
router.get('/logs', adminController.getActivityLogs);
router.get('/export', adminController.exportData);

// Super admin only routes
router.delete('/cleanup', roleMiddleware('super_admin'), adminController.cleanupOldData);
router.put('/settings', roleMiddleware('super_admin'), adminController.updateSettings);

module.exports = router;
