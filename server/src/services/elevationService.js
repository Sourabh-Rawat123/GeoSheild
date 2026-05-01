const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Simple LRU Cache implementation for elevation data
 */
class LRUCache {
    constructor(maxSize = 100) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        // Move to end (most recently used)
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Remove oldest (first inserted)
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(key, value);
    }

    clear() {
        this.cache.clear();
    }
}

/**
 * Request queue with concurrency limiting
 */
class RequestQueue {
    constructor(maxConcurrent = 3) {
        this.maxConcurrent = maxConcurrent;
        this.activeRequests = 0;
        this.queue = [];
    }

    async run(fn) {
        while (this.activeRequests >= this.maxConcurrent) {
            await new Promise(resolve => this.queue.push(resolve));
        }

        this.activeRequests++;
        try {
            return await fn();
        } finally {
            this.activeRequests--;
            const resolve = this.queue.shift();
            if (resolve) resolve();
        }
    }
}

/**
 * Elevation Service with caching, throttling, and retry logic
 * Prevents 429 rate limit errors from open-elevation API
 */
class ElevationService {
    constructor() {
        this.cache = new LRUCache(100); // Cache up to 100 locations
        this.requestQueue = new RequestQueue(2); // Max 2 concurrent requests
        this.ELEVATION_API_URL = 'https://api.open-elevation.com/api/v1/lookup';
        this.MAX_RETRIES = 3;
        this.INITIAL_RETRY_DELAY = 1000; // 1 second
        logger.info('ElevationService initialized with rate limiting and caching');
    }

    /**
     * Generate cache key from coordinates (4 decimal places = ~11m precision)
     */
    getCacheKey(lat, lon, precision = 4) {
        return `${lat.toFixed(precision)},${lon.toFixed(precision)}`;
    }

    /**
     * Exponential backoff retry logic
     */
    async retryWithBackoff(fn, retryCount = 0) {
        try {
            return await fn();
        } catch (error) {
            // Check if it's a rate limit error (429)
            if (error.response?.status === 429 && retryCount < this.MAX_RETRIES) {
                const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
                const jitter = Math.random() * delay * 0.1; // Add 10% jitter
                const totalDelay = delay + jitter;

                logger.warn(`Elevation API rate limited (429). Retrying in ${totalDelay.toFixed(0)}ms. Attempt ${retryCount + 1}/${this.MAX_RETRIES}`, {
                    delay: totalDelay,
                    retryCount
                });

                await new Promise(resolve => setTimeout(resolve, totalDelay));
                return this.retryWithBackoff(fn, retryCount + 1);
            }
            throw error;
        }
    }

    /**
     * Get elevation data with caching and rate limiting
     */
    async getElevationData(lat, lon) {
        const cacheKey = this.getCacheKey(lat, lon);

        // === DEBUG: Log cache lookup ===
        console.log(`🟡 elevationService.getElevationData() called`);
        console.log(`🟡   Latitude: ${lat}`);
        console.log(`🟡   Longitude: ${lon}`);
        console.log(`🟡   Cache key: ${cacheKey}`);
        // ================================

        // Check cache first (avoid API calls)
        const cached = this.cache.get(cacheKey);
        if (cached) {
            console.log(`🟡 ✓ Cache HIT - returning cached elevation: ${cached.elevation}`);
            logger.debug('Elevation cache hit', { cacheKey, elevation: cached.elevation });
            return cached;
        }

        console.log(`🟡 ✗ Cache MISS - calling elevation API`);

        // Use request queue to limit concurrency (max 2 parallel requests)
        return this.requestQueue.run(async () => {
            return this.retryWithBackoff(async () => {
                try {
                    // Create query points: main location + 2 nearby points for slope calculation
                    const locations = [
                        { latitude: lat, longitude: lon },
                        { latitude: lat + 0.001, longitude: lon },
                        { latitude: lat, longitude: lon + 0.001 }
                    ];

                    logger.debug('Calling elevation API', { lat, lon, cacheKey });

                    const response = await axios.post(this.ELEVATION_API_URL, { locations }, {
                        timeout: 10000,
                        headers: {
                            'User-Agent': 'Landslide-Prevention-System/1.0'
                        }
                    });

                    const results = response.data.results;
                    if (!results || results.length < 3) {
                        throw new Error(`Invalid elevation API response: ${JSON.stringify(results)}`);
                    }

                    // Calculate elevations and slope
                    const elevations = results.map(r => r.elevation);
                    const rise = Math.max(
                        Math.abs(elevations[1] - elevations[0]),
                        Math.abs(elevations[2] - elevations[0])
                    );
                    const slopeDegrees = Math.atan(rise / 111) * (180 / Math.PI);

                    const elevationData = {
                        elevation: elevations[0],
                        slope_degrees: slopeDegrees,
                        terrain_variation: Math.max(...elevations) - Math.min(...elevations),
                        cachedAt: new Date(),
                        isCached: false
                    };

                    // Cache the result for future requests
                    this.cache.set(cacheKey, elevationData);
                    console.log(`🟡 Elevation data cached for ${cacheKey}: elevation=${elevationData.elevation}, slope=${elevationData.slope_degrees.toFixed(2)}°`);
                    logger.debug('Elevation data cached', {
                        cacheKey,
                        elevation: elevationData.elevation,
                        slope: elevationData.slope_degrees
                    });

                    return elevationData;

                } catch (error) {
                    // Handle different error types
                    if (error.response?.status === 429) {
                        logger.error('Elevation API rate limited (429)', { lat, lon, cacheKey });
                        throw error; // Will trigger retry with backoff
                    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                        logger.warn('Elevation API timeout/abort', { lat, lon, error: error.code });
                        return this.getFallbackElevationData(true);
                    } else if (error.message?.includes('Invalid elevation API response')) {
                        logger.error('Elevation API invalid response', { lat, lon, error: error.message });
                        return this.getFallbackElevationData(true);
                    } else {
                        logger.error('Elevation API error', { lat, lon, error: error.message });
                        return this.getFallbackElevationData(true);
                    }
                }
            });
        });
    }

    /**
     * Batch elevation requests for multiple locations
     * More efficient than individual requests
     */
    async getElevationDataBatch(locations) {
        logger.info('Processing batch elevation request', { count: locations.length });

        const results = await Promise.allSettled(
            locations.map(loc => this.getElevationData(loc.lat, loc.lon))
        );

        return results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return {
                    location: locations[index],
                    data: result.value,
                    success: true
                };
            } else {
                logger.warn('Batch elevation request failed for location', {
                    location: locations[index],
                    error: result.reason?.message
                });
                return {
                    location: locations[index],
                    error: result.reason?.message,
                    success: false,
                    data: this.getFallbackElevationData(true)
                };
            }
        });
    }

    /**
     * Fallback elevation data (safe defaults)
     */
    getFallbackElevationData(isFallback = false) {
        return {
            elevation: 0,
            slope_degrees: 0,
            terrain_variation: 0,
            isFallback,
            cachedAt: new Date()
        };
    }

    /**
     * Clear cache manually
     */
    clearCache() {
        this.cache.clear();
        logger.info('Elevation service cache cleared');
    }

    /**
     * Get cache and queue statistics for monitoring
     */
    getStats() {
        return {
            cache: {
                size: this.cache.cache.size,
                maxSize: this.cache.maxSize
            },
            queue: {
                activeConcurrentRequests: this.requestQueue.activeRequests,
                queuedRequests: this.requestQueue.queue.length,
                maxConcurrent: this.requestQueue.maxConcurrent
            },
            rateLimit: {
                maxRetries: this.MAX_RETRIES,
                initialRetryDelay: this.INITIAL_RETRY_DELAY
            }
        };
    }
}

module.exports = new ElevationService();
