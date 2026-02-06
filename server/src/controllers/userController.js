const User = require('../models/User');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/async_handler');
const ApiError = require('../utils/api_error');

/**
 * @desc    Get current user profile
 * @route   GET /api/users/me
 * @access  Private
 */
exports.getMyProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        throw new ApiError('User not found', 404);
    }

    res.json({
        success: true,
        user: user.getPublicProfile()
    });
});

/**
 * @desc    Update current user profile
 * @route   PUT /api/users/me
 * @access  Private
 */
exports.updateMyProfile = asyncHandler(async (req, res) => {
    const updates = req.body;
    const allowedUpdates = ['name', 'location', 'alertPreferences', 'phone'];
    const updateKeys = Object.keys(updates);

    // Check for invalid updates
    const isValidOperation = updateKeys.every(key => allowedUpdates.includes(key));
    if (!isValidOperation) {
        logger.warn('Invalid profile update attempt', { keys: updateKeys, userId: req.user.id });
        throw new ApiError('Invalid updates', 400);
    }

    const user = await User.findById(req.user.id);
    if (!user) {
        throw new ApiError('User not found', 404);
    }

    // Apply updates with validation
    try {
        updateKeys.forEach(key => {
            if (key === 'location' && updates[key]) {
                // Ensure location has proper GeoJSON structure
                user.location = {
                    type: 'Point',
                    coordinates: updates[key].coordinates || [0, 0],
                    address: updates[key].address || '',
                    city: updates[key].city || '',
                    state: updates[key].state || ''
                };
            } else {
                user[key] = updates[key];
            }
        });

        await user.save();

        logger.info(`User profile updated: ${user.email}`, { updates: updateKeys });

        res.json({
            success: true,
            user: user.getPublicProfile()
        });
    } catch (error) {
        logger.error('Profile update failed', { error: error.message, userId: req.user.id });
        throw new ApiError(`Profile update failed: ${error.message}`, 500);
    }
});

/**
 * @desc    Delete current user account
 * @route   DELETE /api/users/me
 * @access  Private
 */
exports.deleteMyAccount = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        throw new ApiError('User not found', 404);
    }

    await user.deleteOne();

    logger.info(`User account deleted: ${user.email}`);

    res.json({
        success: true,
        message: 'Account deleted successfully'
    });
});

/**
 * @desc    Get all users (admin only)
 * @route   GET /api/users
 * @access  Private/Admin
 */
exports.getAllUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, role, search } = req.query;

    const query = {};

    // Filter by role
    if (role) {
        query.role = role;
    }

    // Search by name or email
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }

    const users = await User.find(query)
        .select('-password')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

    const count = await User.countDocuments(query);

    res.json({
        success: true,
        users,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        total: count
    });
});

/**
 * @desc    Get user by ID (admin only)
 * @route   GET /api/users/:id
 * @access  Private/Admin
 */
exports.getUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
        throw new ApiError('User not found', 404);
    }

    res.json({
        success: true,
        user
    });
});

/**
 * @desc    Update user by ID (admin only)
 * @route   PUT /api/users/:id
 * @access  Private/Admin
 */
exports.updateUser = asyncHandler(async (req, res) => {
    const updates = req.body;
    const allowedUpdates = ['name', 'email', 'role', 'location', 'alertPreferences'];
    const updateKeys = Object.keys(updates);

    // Check for invalid updates
    const isValidOperation = updateKeys.every(key => allowedUpdates.includes(key));
    if (!isValidOperation) {
        throw new ApiError('Invalid updates', 400);
    }

    const user = await User.findById(req.params.id);
    if (!user) {
        throw new ApiError('User not found', 404);
    }

    // Apply updates
    updateKeys.forEach(key => user[key] = updates[key]);
    await user.save();

    logger.info(`User updated by admin: ${user.email}`);

    res.json({
        success: true,
        user: user.getPublicProfile()
    });
});

/**
 * @desc    Delete user by ID (admin only)
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        throw new ApiError('User not found', 404);
    }

    await user.deleteOne();

    logger.info(`User deleted by admin: ${user.email}`);

    res.json({
        success: true,
        message: 'User deleted successfully'
    });
});

/**
 * @desc    Get user statistics (admin only)
 * @route   GET /api/users/stats
 * @access  Private/Admin
 */
exports.getUserStats = asyncHandler(async (req, res) => {
    const totalUsers = await User.countDocuments();
    const usersByRole = await User.aggregate([
        {
            $group: {
                _id: '$role',
                count: { $sum: 1 }
            }
        }
    ]);

    const recentUsers = await User.find()
        .select('name email role createdAt')
        .sort({ createdAt: -1 })
        .limit(5);

    res.json({
        success: true,
        stats: {
            total: totalUsers,
            byRole: usersByRole,
            recent: recentUsers
        }
    });
});
