/**
 * Model Retraining Scheduler
 * Automatically retrains ML model daily with new production data
 */
const cron = require('node-cron');
const { PythonShell } = require('python-shell');
const path = require('path');
const logger = require('../utils/logger');

class ModelRetrainingScheduler {
    constructor() {
        this.retrainingScript = path.join(__dirname, '..', '..', '..', 'ml-service', 'app', 'services', 'model_retraining.py');
        this.isRetraining = false;
    }

    /**
     * Start scheduled retraining
     * Default: Daily at 2:00 AM
     */
    start() {
        // Run daily at 2:00 AM
        cron.schedule('0 2 * * *', () => {
            this.runRetraining();
        });

        // Also run weekly on Sunday at 3:00 AM (more comprehensive)
        cron.schedule('0 3 * * 0', () => {
            this.runRetraining(true);
        });

        logger.info('Model retraining scheduler started');
        logger.info('- Daily retraining: 2:00 AM');
        logger.info('- Weekly full retrain: Sunday 3:00 AM');
    }

    /**
     * Manually trigger retraining
     */
    async runRetraining(fullRetrain = false) {
        if (this.isRetraining) {
            logger.warn('Retraining already in progress, skipping...');
            return;
        }

        this.isRetraining = true;
        logger.info(`Starting ${fullRetrain ? 'full' : 'incremental'} model retraining...`);

        try {
            const options = {
                mode: 'text',
                pythonPath: process.env.PYTHON_PATH || 'python',
                scriptPath: path.dirname(this.retrainingScript),
                args: fullRetrain ? ['--full'] : []
            };

            const results = await PythonShell.run(path.basename(this.retrainingScript), options);

            logger.info('Retraining completed successfully');
            logger.info(`Results: ${results.join('\n')}`);

            // Notify admins about new model version
            // await notifyAdmins('Model retrained successfully');

        } catch (error) {
            logger.error('Model retraining failed:', error);
            // await notifyAdmins('Model retraining failed', error.message);
        } finally {
            this.isRetraining = false;
        }
    }
}

module.exports = new ModelRetrainingScheduler();
