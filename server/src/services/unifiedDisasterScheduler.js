/**
 * Unified Disaster Scheduler
 * Automatically syncs NASA EONET + ReliefWeb every 6 hours
 * Implements: API_INTEGRATION_GUIDE.md requirements
 */

const cron = require('node-cron');
const unifiedDisasterService = require('./unifiedDisasterService');
const logger = require('../utils/logger');

class UnifiedDisasterScheduler {
    constructor() {
        this.job = null;
        this.isRunning = false;
        this.syncInterval = process.env.DISASTER_SYNC_INTERVAL || 21600000; // 6 hours default
        this.lastSyncTime = null;
        this.syncCount = 0;
    }

    /**
     * Start scheduler
     * Cron: Runs every 6 hours at minute 0 (0 0-23/6 * * *)
     */
    start() {
        if (this.isRunning) {
            logger.warn('Scheduler already running');
            return;
        }

        logger.info('🔄 Starting Unified Disaster Scheduler...');
        logger.info(`   Sync interval: ${this.syncInterval / 1000 / 60 / 60} hours`);

        // Schedule sync every 6 hours
        this.job = cron.schedule('0 */6 * * *', async () => {
            await this.performSync();
        });

        // Also run on startup after 5 seconds
        setTimeout(() => this.performSync(), 5000);

        this.isRunning = true;
        logger.info('✅ Unified Disaster Scheduler started');
    }

    /**
     * Stop scheduler
     */
    stop() {
        if (this.job) {
            this.job.stop();
            this.isRunning = false;
            logger.info('🛑 Unified Disaster Scheduler stopped');
        }
    }

    /**
     * Perform sync operation
     */
    async performSync() {
        try {
            const startTime = Date.now();
            this.syncCount++;

            logger.info(`🔄 [${this.syncCount}] Starting unified disaster sync...`);

            // Perform sync
            const result = await unifiedDisasterService.syncUnified();

            const duration = Date.now() - startTime;
            this.lastSyncTime = new Date();

            if (result.success) {
                logger.info(`✅ [${this.syncCount}] Sync successful:`);
                logger.info(`   NASA EONET: ${result.nasa} events`);
                logger.info(`   ReliefWeb: ${result.reliefweb} events`);
                logger.info(`   Total (deduplicated): ${result.total} events`);
                logger.info(`   DB: ${result.upserted} upserted, ${result.updated} updated`);
                logger.info(`   Duration: ${duration}ms`);

                // Emit event for monitoring/alerts
                this.onSyncSuccess(result);
            } else {
                logger.error(`❌ [${this.syncCount}] Sync failed: ${result.error}`);
                this.onSyncError(result.error);
            }

        } catch (error) {
            logger.error(`❌ Sync error: ${error.message}`);
            this.onSyncError(error.message);
        }
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            running: this.isRunning,
            lastSync: this.lastSyncTime,
            syncCount: this.syncCount,
            syncInterval: `${this.syncInterval / 1000 / 60 / 60} hours`,
            nextSync: this.calculateNextSync()
        };
    }

    /**
     * Calculate next sync time
     */
    calculateNextSync() {
        if (!this.isRunning) return null;
        const now = new Date();
        const nextSync = new Date(now);
        nextSync.setHours(nextSync.getHours() + 6);
        nextSync.setMinutes(0);
        nextSync.setSeconds(0);
        return nextSync;
    }

    /**
     * Success callback
     */
    onSyncSuccess(result) {
        // Hook for monitoring/alerts
        // e.g., send to monitoring service, update dashboard, etc.
    }

    /**
     * Error callback
     */
    onSyncError(error) {
        // Hook for error handling
        // e.g., send alert, log to monitoring service, etc.
    }

    /**
     * Manual sync trigger (for debugging/testing)
     */
    async syncNow() {
        logger.info('🔔 Manual sync triggered');
        return await this.performSync();
    }
}

module.exports = new UnifiedDisasterScheduler();
