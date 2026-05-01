/**
 * Error Handling & Retry Logic Utilities
 * Enhanced error handling with retry and fallback mechanisms
 */

const logger = require('./logger');

class ErrorHandler {
    constructor() {
        this.failureLog = [];
        this.retryAttempts = 3;
        this.retryDelay = 2000; // 2 seconds
    }

    /**
     * Execute with retry and exponential backoff
     * @param {Function} fn - Function to execute
     * @param {String} name - Operation name (for logging)
     * @param {Number} maxAttempts - Maximum retry attempts
     */
    async retryWithBackoff(fn, name = 'Operation', maxAttempts = this.retryAttempts) {
        let lastError;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                logger.info(`   [${name}] Attempt ${attempt}/${maxAttempts}...`);
                const result = await fn();
                return result;
            } catch (error) {
                lastError = error;
                logger.warn(`   [${name}] Attempt ${attempt} failed: ${error.message}`);

                if (attempt < maxAttempts) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    logger.info(`   [${name}] Retrying in ${delay / 1000}s...`);
                    await this.sleep(delay);
                }
            }
        }

        return {
            success: false,
            error: lastError,
            attempts: maxAttempts
        };
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Log failure for monitoring
     */
    logFailure(source, error) {
        this.failureLog.push({
            source,
            error: error.message || String(error),
            timestamp: new Date(),
            stack: error.stack
        });

        // Keep only last 500 failures
        if (this.failureLog.length > 500) {
            this.failureLog.shift();
        }

        logger.error(`[FAILURE] ${source}: ${error.message}`);
    }

    /**
     * Get failure statistics
     */
    getFailureStats(hours = 24) {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        const failures = this.failureLog.filter(f => f.timestamp >= since);

        const bySource = {};
        failures.forEach(f => {
            if (!bySource[f.source]) bySource[f.source] = 0;
            bySource[f.source]++;
        });

        return {
            total: failures.length,
            period: `${hours} hours`,
            bySource,
            failures: failures.slice(-20) // Last 20
        };
    }

    /**
     * Validate API response
     */
    validateResponse(response, name = 'API') {
        if (!response) {
            throw new Error(`${name}: Empty response`);
        }

        if (response.status !== 200 && response.status !== 201) {
            throw new Error(`${name}: HTTP ${response.status}`);
        }

        if (!response.data) {
            throw new Error(`${name}: No data in response`);
        }

        return true;
    }

    /**
     * Handle circuit breaker pattern (fail open)
     */
    async executeWithCircuitBreaker(fn, name = 'Operation', threshold = 5) {
        const recentFailures = this.failureLog
            .filter(f => f.source === name && f.timestamp > new Date(Date.now() - 5 * 60 * 1000))
            .length;

        if (recentFailures >= threshold) {
            logger.warn(`⚠️ [CIRCUIT BREAKER] ${name} circuit open (${recentFailures} failures)`);
            return { success: false, error: 'Circuit breaker open', circuitOpen: true };
        }

        try {
            return await fn();
        } catch (error) {
            this.logFailure(name, error);
            throw error;
        }
    }

    /**
     * Graceful degradation wrapper
     */
    async executeWithFallback(primaryFn, fallbackFn, name = 'Operation') {
        try {
            logger.info(`[${name}] Attempting primary operation...`);
            return await primaryFn();
        } catch (error) {
            logger.warn(`⚠️ [${name}] Primary failed, using fallback: ${error.message}`);
            this.logFailure(`${name}_Primary`, error);

            try {
                return await fallbackFn();
            } catch (fallbackError) {
                logger.error(`❌ [${name}] Fallback also failed: ${fallbackError.message}`);
                this.logFailure(`${name}_Fallback`, fallbackError);
                throw fallbackError;
            }
        }
    }

    /**
     * Timeout wrapper
     */
    async executeWithTimeout(fn, timeoutMs = 30000, name = 'Operation') {
        return Promise.race([
            fn(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`${name} timeout after ${timeoutMs}ms`)), timeoutMs)
            )
        ]);
    }

    /**
     * Error recovery recommendations
     */
    getRecoveryRecommendations(source) {
        const failures = this.failureLog.filter(f => f.source === source && f.timestamp > new Date(Date.now() - 60 * 60 * 1000));

        if (failures.length === 0) {
            return { status: 'healthy', recommendation: 'No issues detected' };
        }

        if (failures.length < 3) {
            return { status: 'degraded', recommendation: 'Monitor. Occasional failures are normal.' };
        }

        if (failures.length < 10) {
            return { status: 'warning', recommendation: 'Check API status. Consider reducing frequency.' };
        }

        return { status: 'critical', recommendation: 'Use fallback data. Skip this source for now.' };
    }
}

module.exports = new ErrorHandler();
