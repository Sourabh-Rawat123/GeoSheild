require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require('cors');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const predictionRoutes = require('./routes/predictions');
const alertRoutes = require('./routes/alerts');
const weatherRoutes = require('./routes/weather');
const incidentRoutes = require('./routes/incidents');
const adminRoutes = require('./routes/admin');
const seedRoutes = require('./routes/seed');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 8080;

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        logger.info(`${req.method} ${req.path}`);
        next();
    });
}

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'GeoShield AI Backend',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Root route
app.get('/', (req, res) => {
    res.json({
        service: 'GeoShield AI Backend Server',
        version: '1.0.0',
        status: 'operational',
        endpoints: {
            auth: '/api/auth',
            users: '/api/users',
            predictions: '/api/predictions',
            alerts: '/api/alerts',
            weather: '/api/weather',
            incidents: '/api/incidents',
            admin: '/api/admin',
            seed: '/api/seed',
            health: '/health'
        }
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/seed', seedRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.path
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Database connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        logger.info('✓ MongoDB connected successfully');

        // Start server
        app.listen(PORT, () => {
            logger.info(`✓ Server running on port ${PORT}`);
            logger.info(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`✓ API Base: http://localhost:${PORT}/api`);
        });
    })
    .catch((err) => {
        logger.error(`✗ MongoDB connection error: ${err.message}`);
        process.exit(1);
    });

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    mongoose.connection.close(() => {
        logger.info('MongoDB connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    mongoose.connection.close(() => {
        logger.info('MongoDB connection closed');
        process.exit(0);
    });
});

module.exports = app;
