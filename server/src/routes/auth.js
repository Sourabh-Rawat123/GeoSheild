const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');

// Validation middleware
const signupValidation = [
    body('name').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
];

const loginValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
];

const passwordValidation = [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 }),
];

// Validation wrapper
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// POST /api/auth/signup - Register new user
router.post('/signup', signupValidation, validate, authController.signup);

// POST /api/auth/login - Login user
router.post('/login', loginValidation, validate, authController.login);

// GET /api/auth/me - Get current user
router.get('/me', authMiddleware, authController.getMe);

// PUT /api/auth/password - Update password
router.put('/password', authMiddleware, passwordValidation, validate, authController.updatePassword);

// POST /api/auth/forgot-password - Forgot password
router.post('/forgot-password', authController.forgotPassword);

// POST /api/auth/reset-password - Reset password
router.post('/reset-password', authController.resetPassword);

// POST /api/auth/logout - Logout
router.post('/logout', authMiddleware, authController.logout);

// POST /api/auth/verify-token - Verify JWT token
router.post('/verify-token', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ valid: false, error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ valid: false, error: 'Invalid token' });
        }

        res.json({
            valid: true,
            user: user.getPublicProfile()
        });
    } catch (err) {
        res.status(401).json({ valid: false, error: 'Token verification failed' });
    }
});

module.exports = router;
