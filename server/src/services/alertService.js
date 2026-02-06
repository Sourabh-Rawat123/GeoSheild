const logger = require('../utils/logger');
const Prediction = require('../models/Prediction');
const User = require('../models/User');
const weatherService = require('./weatherService');

class AlertService {
    constructor() {
        this.monitoringIntervalId = null;
        this.alertThresholds = {
            Low: { probability: 0.25, rainfall24h: 50 },
            Moderate: { probability: 0.50, rainfall24h: 75 },
            High: { probability: 0.75, rainfall24h: 100 },
            Severe: { probability: 0.90, rainfall24h: 150 }
        };
    }

    /**
     * Start monitoring risk levels and weather conditions
     */
    startMonitoring(intervalMinutes = 30) {
        if (this.monitoringIntervalId) {
            logger.warn('Alert monitoring already running');
            return;
        }

        logger.info(`Starting alert monitoring (interval: ${intervalMinutes} minutes)`);

        // Run immediately
        this.checkRiskLevels();

        // Then run at intervals
        this.monitoringIntervalId = setInterval(() => {
            this.checkRiskLevels();
        }, intervalMinutes * 60 * 1000);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitoringIntervalId) {
            clearInterval(this.monitoringIntervalId);
            this.monitoringIntervalId = null;
            logger.info('Alert monitoring stopped');
        }
    }

    /**
     * Check all active predictions and trigger alerts if needed
     */
    async checkRiskLevels() {
        try {
            logger.info('Checking risk levels for alerts...');

            // Get all active high-risk predictions
            const highRiskPredictions = await Prediction.find({
                status: 'active',
                validUntil: { $gt: new Date() },
                'prediction.riskLevel': { $in: ['High', 'Severe'] }
            }).populate('userId');

            for (const prediction of highRiskPredictions) {
                await this.evaluateAndAlert(prediction);
            }

            logger.info(`Evaluated ${highRiskPredictions.length} high-risk locations`);
        } catch (err) {
            logger.error(`Alert check error: ${err.message}`);
        }
    }

    /**
     * Evaluate a prediction and send alert if conditions warrant
     */
    async evaluateAndAlert(prediction) {
        try {
            const [lon, lat] = prediction.location.coordinates;

            // Get current weather and rainfall forecast
            const rainfallAlert = await weatherService.getRainfallAlert(lat, lon);

            // Determine if alert should be sent
            const shouldAlert = this.shouldSendAlert(prediction, rainfallAlert);

            if (shouldAlert) {
                await this.sendAlert(prediction, rainfallAlert);
            }
        } catch (err) {
            logger.error(`Failed to evaluate prediction ${prediction._id}: ${err.message}`);
        }
    }

    /**
     * Determine if an alert should be sent
     */
    shouldSendAlert(prediction, rainfallAlert) {
        const riskLevel = prediction.prediction.riskLevel;
        const threshold = this.alertThresholds[riskLevel];

        if (!threshold) return false;

        // Check if probability is high enough
        if (prediction.prediction.probability < threshold.probability) {
            return false;
        }

        // Check if rainfall forecast exceeds threshold
        if (rainfallAlert.forecast24h && rainfallAlert.forecast24h > threshold.rainfall24h) {
            return true;
        }

        // Check if there are active weather alerts
        if (rainfallAlert.hasAlert && rainfallAlert.alerts.some(a => a.severity === 'high' || a.severity === 'severe')) {
            return true;
        }

        return false;
    }

    /**
     * Send alert to user
     */
    async sendAlert(prediction, rainfallAlert) {
        try {
            const user = prediction.userId;

            if (!user) {
                logger.warn(`No user found for prediction ${prediction._id}`);
                return;
            }

            // Check user's alert preferences
            if (!this.shouldNotifyUser(user, prediction.prediction.riskLevel)) {
                return;
            }

            const alertData = {
                type: 'landslide_warning',
                severity: prediction.prediction.riskLevel.toLowerCase(),
                location: prediction.location,
                probability: prediction.prediction.probability,
                rainfall: rainfallAlert.forecast24h,
                weatherAlerts: rainfallAlert.alerts,
                timestamp: new Date(),
                message: this.generateAlertMessage(prediction, rainfallAlert)
            };

            // Log the alert (in production, this would send email/SMS/push notification)
            logger.warn(`ALERT for user ${user.email}: ${alertData.message}`);

            // Store alert in user's alert history (if you have an Alert model)
            // await Alert.create({ userId: user._id, ...alertData });

            return alertData;
        } catch (err) {
            logger.error(`Failed to send alert: ${err.message}`);
        }
    }

    /**
     * Check if user should be notified based on preferences
     */
    shouldNotifyUser(user, riskLevel) {
        if (!user.alertPreferences) return true;

        const prefs = user.alertPreferences;

        // Check if alerts are enabled
        if (!prefs.enabled) return false;

        // Check minimum risk level
        const riskLevels = ['Low', 'Moderate', 'High', 'Severe'];
        const userMinLevel = riskLevels.indexOf(prefs.minRiskLevel || 'Moderate');
        const currentLevel = riskLevels.indexOf(riskLevel);

        return currentLevel >= userMinLevel;
    }

    /**
     * Generate human-readable alert message
     */
    generateAlertMessage(prediction, rainfallAlert) {
        const riskLevel = prediction.prediction.riskLevel;
        const prob = (prediction.prediction.probability * 100).toFixed(0);
        const rainfall = rainfallAlert.forecast24h ? rainfallAlert.forecast24h.toFixed(1) : 'N/A';
        const location = prediction.location.address ||
            `${prediction.location.city || 'your area'}, ${prediction.location.state || ''}`;

        let message = `⚠️ ${riskLevel.toUpperCase()} landslide risk detected at ${location}. `;
        message += `Risk probability: ${prob}%. `;

        if (rainfallAlert.forecast24h > 0) {
            message += `Expected rainfall: ${rainfall}mm in next 24 hours. `;
        }

        if (rainfallAlert.alerts && rainfallAlert.alerts.length > 0) {
            message += `Weather alerts: ${rainfallAlert.alerts[0].message}. `;
        }

        message += `Please take necessary precautions and stay alert.`;

        return message;
    }

    /**
     * Manually trigger alert check for a specific location
     */
    async checkLocation(latitude, longitude, userId) {
        try {
            // Find or create prediction for this location
            const predictions = await Prediction.find({
                userId,
                status: 'active',
                location: {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: [longitude, latitude]
                        },
                        $maxDistance: 1000 // 1km radius
                    }
                }
            }).limit(1);

            if (predictions.length > 0) {
                const alert = await this.evaluateAndAlert(predictions[0]);
                return alert;
            }

            return null;
        } catch (err) {
            logger.error(`Manual location check failed: ${err.message}`);
            throw err;
        }
    }
}

module.exports = new AlertService();
