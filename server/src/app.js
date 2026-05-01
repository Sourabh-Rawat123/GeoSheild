require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const predictionRoutes = require('./routes/predictions');
const alertRoutes = require('./routes/alerts');
const weatherRoutes = require('./routes/weather');
const incidentRoutes = require('./routes/incidents');
const adminRoutes = require('./routes/admin');
const seedRoutes = require('./routes/seed');
const disasterRoutes = require('./routes/disasters');
const errorHandler = require('./middleware/errorHandler');
const modelRetrainingScheduler = require('./services/modelRetrainingScheduler');
const unifiedDisasterScheduler = require('./services/unifiedDisasterScheduler');
const { initializeIndexes } = require('./utils/indexInitializer');

const app = express();
const PORT = process.env.PORT || 8080;

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true
}));

// Security middleware
app.use(helmet()); // Secure HTTP headers
app.use(mongoSanitize()); // Prevent NoSQL injection

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

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
app.use('/api/disasters', disasterRoutes);

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
    .then(async () => {
        logger.info('✓ MongoDB connected successfully');

        // Initialize database indexes
        try {
            await initializeIndexes();
        } catch (error) {
            logger.warn(`Index initialization warning: ${error.message}`);
        }

        // Start model retraining scheduler
        if (process.env.ENABLE_AUTO_RETRAIN !== 'false') {
            modelRetrainingScheduler.start();
            logger.info('✓ Model retraining scheduler started');
        }

        // Start unified disaster scheduler (NASA EONET + ReliefWeb)
        if (process.env.ENABLE_DISASTER_SYNC !== 'false') {
            unifiedDisasterScheduler.start();
            logger.info('✓ Unified Disaster Scheduler started');
        }

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
    unifiedDisasterScheduler.stop();
    mongoose.connection.close(() => {
        logger.info('MongoDB connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    unifiedDisasterScheduler.stop();
    mongoose.connection.close(() => {
        logger.info('MongoDB connection closed');
        process.exit(0);
    });
});

module.exports = app;
