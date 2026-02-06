const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const userController = require('../controllers/userController');

// User profile routes
router.get('/me', authMiddleware, userController.getMyProfile);
router.put('/me', authMiddleware, userController.updateMyProfile);
router.delete('/me', authMiddleware, userController.deleteMyAccount);

// Admin routes
router.get('/stats', authMiddleware, roleMiddleware('admin', 'super_admin'), userController.getUserStats);
router.get('/', authMiddleware, roleMiddleware('admin', 'super_admin'), userController.getAllUsers);
router.get('/:id', authMiddleware, roleMiddleware('admin', 'super_admin'), userController.getUserById);
router.put('/:id', authMiddleware, roleMiddleware('admin', 'super_admin'), userController.updateUser);
router.delete('/:id', authMiddleware, roleMiddleware('admin', 'super_admin'), userController.deleteUser);

module.exports = router;
