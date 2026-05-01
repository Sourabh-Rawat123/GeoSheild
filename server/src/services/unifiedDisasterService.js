/**
 * Unified Disaster Data Service
 * Combines NASA EONET (Global Real-time) + ReliefWeb (India-focused + verified)
 *
 * Strategy:
 * - NASA EONET: Global coverage, real-time updates, automated
 * - ReliefWeb: UN-backed, verified, India-focused, curated
 *
 * Data Flow:
 * NASA EONET → Check for duplicates → Merge with ReliefWeb → Deduplicate → Store
 */

const axios = require('axios');
const RealTimeEvent = require('../models/RealTimeEvent');
const logger = require('../utils/logger');

const NASA_EONET_API = 'https://eonet.gsfc.nasa.gov/api/v3/events';
const RELIEFWEB_API = 'https://api.reliefweb.int/v2/disasters';
const LANDSLIDE_CATEGORY = 14; // NASA EONET landslide code

class UnifiedDisasterService {
    /**
     * FALLBACK DATA: Real landslide incidents from verified sources
     * Used when both NASA EONET and ReliefWeb APIs fail
     * Source: Historical data from USGS, GSI, IIRS
     */
    getFallbackData() {
        return [
            {
                externalId: 'FALLBACK_MALIN_2014',
                source: 'Fallback_USGS',
                title: 'Malin Village Disaster - Maharashtra',
                description: 'One of India\'s deadliest landslide disasters. Heavy monsoon rainfall triggered massive slide burying entire village. 151 fatalities.',
                location: { type: 'Point', coordinates: [73.8567, 18.5204] },
                coordinates: { latitude: 18.5204, longitude: 73.8567 },
                eventDate: new Date('2014-07-30'),
                severity: 'Catastrophic',
                verified: true,
                metadata: {
                    source: 'USGS Historical',
                    note: 'Fallback data - use when APIs unavailable'
                }
            },
            {
                externalId: 'FALLBACK_UTTARKASHI_2013',
                source: 'Fallback_GSI',
                title: 'Uttarkashi Disaster - Uttarakhand',
                description: 'Major cloudburst triggered landslides. Heavy rainfall (>300mm/24h) caused massive debris flows. Road NH-119 blocked.',
                location: { type: 'Point', coordinates: [78.8, 30.7] },
                coordinates: { latitude: 30.7, longitude: 78.8 },
                eventDate: new Date('2013-06-16'),
                severity: 'Catastrophic',
                verified: true,
                metadata: {
                    source: 'GSI Historical',
                    note: 'Fallback data - use when APIs unavailable'
                }
            },
            {
                externalId: 'FALLBACK_DIMA_HASAO_2022',
                source: 'Fallback_GSI',
                title: 'Dima Hasao Incident - Assam',
                description: 'Severe landslides in Dima Hasao district. Rainfall >200mm triggered debris flows. Multiple casualties reported.',
                location: { type: 'Point', coordinates: [92.94, 26.20] },
                coordinates: { latitude: 26.20, longitude: 92.94 },
                eventDate: new Date('2022-05-15'),
                severity: 'Catastrophic',
                verified: true,
                metadata: {
                    source: 'GSI',
                    note: 'Fallback data - use when APIs unavailable'
                }
            }
        ];
    }

    /**
     * STRATEGY 1: NASA EONET - Global, Automated, Real-time
     * Best for: Global coverage, automatic updates, real-time alerts
     * 
     * Safe parsing with defensive checks to handle malformed API responses
     */
    async fetchNasaEonet() {
        try {
            logger.info('📡 Fetching from NASA EONET (Global)...');

            const response = await axios.get(NASA_EONET_API, {
                params: {
                    category: LANDSLIDE_CATEGORY,
                    limit: 100,
                    days: 30
                },
                timeout: 10000
            });

            // Defensive: validate response structure
            if (!response?.data) {
                logger.warn('NASA EONET: Empty response received');
                return [];
            }

            const rawEvents = response.data.events;
            if (!Array.isArray(rawEvents)) {
                logger.warn('NASA EONET: events is not an array', { received: typeof rawEvents });
                return [];
            }

            // Parse events with defensive checks
            const events = [];
            for (const event of rawEvents) {
                try {
                    // Safe coordinate extraction
                    const coords = this._extractCoordinatesFromEvent(event);
                    if (!coords) {
                        logger.debug('NASA EONET: Skipping event with invalid coordinates', {
                            eventId: event?.id,
                            title: event?.title
                        });
                        continue;
                    }

                    // Safe date extraction
                    const eventDate = this._extractEventDate(event);
                    if (!eventDate) {
                        logger.debug('NASA EONET: Skipping event with invalid date', {
                            eventId: event?.id,
                            title: event?.title
                        });
                        continue;
                    }

                    // Safe ID and title extraction
                    const eventId = event?.id;
                    const title = event?.title?.trim();
                    if (!eventId || !title) {
                        logger.debug('NASA EONET: Skipping event with missing required fields', {
                            hasId: !!eventId,
                            hasTitle: !!title
                        });
                        continue;
                    }

                    // Build valid event object
                    const parsedEvent = {
                        externalId: `NASA_${eventId}`,
                        source: 'NASA_EONET',
                        title: title,
                        description: (event?.description || '').trim(),
                        location: {
                            type: 'Point',
                            coordinates: [coords.longitude, coords.latitude]
                        },
                        coordinates: {
                            latitude: coords.latitude,
                            longitude: coords.longitude
                        },
                        eventDate: eventDate,
                        reportedDate: this._extractReportedDate(event) || eventDate,
                        severity: this._estimateSeverity(title + ' ' + (event?.description || '')),
                        metadata: {
                            eventId: eventId,
                            sources: Array.isArray(event?.sources) ? event.sources : [],
                            links: Array.isArray(event?.links) ? event.links : []
                        }
                    };

                    events.push(parsedEvent);

                } catch (parseError) {
                    logger.error('NASA EONET: Error parsing individual event', {
                        error: parseError.message,
                        eventId: event?.id,
                        title: event?.title
                    });
                    // Continue processing other events instead of failing
                    continue;
                }
            }

            logger.info(`✅ NASA EONET: ${events.length} valid events parsed from ${rawEvents.length} received`);
            return events;

        } catch (error) {
            logger.warn(`⚠️ NASA EONET fetch failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Safe coordinate extraction from NASA EONET event
     * Returns {latitude, longitude} or null if invalid
     */
    _extractCoordinatesFromEvent(event) {
        try {
            // Check geometries array exists and has items
            const geometries = event?.geometries;
            if (!Array.isArray(geometries) || geometries.length === 0) {
                return null;
            }

            const firstGeometry = geometries[0];
            if (!firstGeometry) return null;

            // Check coordinates array exists and has 2+ items [lon, lat] or [lon, lat, ...]
            const coordinates = firstGeometry?.coordinates;
            if (!Array.isArray(coordinates) || coordinates.length < 2) {
                return null;
            }

            const longitude = Number(coordinates[0]);
            const latitude = Number(coordinates[1]);

            // Validate coordinate ranges
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                return null;
            }
            if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
                return null;
            }

            return { latitude, longitude };

        } catch (error) {
            logger.debug('Coordinate extraction error', { error: error.message });
            return null;
        }
    }

    /**
     * Safe date extraction from NASA EONET event
     * Returns Date object or null if invalid
     */
    _extractEventDate(event) {
        try {
            // Try multiple date fields in order of preference
            const dateStr = event?.closed || event?.updated || event?.created;

            if (!dateStr) {
                return null;
            }

            const date = new Date(dateStr);

            // Validate it's a valid date
            if (!Number.isFinite(date.getTime())) {
                return null;
            }

            return date;

        } catch (error) {
            logger.debug('Event date extraction error', { error: error.message });
            return null;
        }
    }

    /**
     * Safe reported date extraction from NASA EONET event
     */
    _extractReportedDate(event) {
        try {
            const dateStr = event?.created;
            if (!dateStr) return null;

            const date = new Date(dateStr);
            if (!Number.isFinite(date.getTime())) {
                return null;
            }

            return date;

        } catch (error) {
            return null;
        }
    }

    /**
     * STRATEGY 2: ReliefWeb - India-focused, Verified, UN-backed
     * Best for: India coverage, verified data, human-curated
     */
    async fetchReliefWeb() {
        try {
            logger.info('🌐 Fetching from ReliefWeb (India-focused)...');

            const response = await axios.get(RELIEFWEB_API, {
                params: {
                    appname: 'geoshield-monitor',
                    'filter[field]': 'country.iso3',
                    'filter[value]': 'IND',
                    limit: 100,
                    sort: 'date.created:desc'
                },
                timeout: 10000
            });

            const events = (response.data.data || []).map(disaster => ({
                externalId: `RELIEFWEB_${disaster.id}`,
                source: 'ReliefWeb',
                title: disaster.title,
                description: disaster.summary || '',
                location: this._parseReliefWebLocation(disaster),
                coordinates: {
                    latitude: disaster.profile?.location?.[1] || 20,
                    longitude: disaster.profile?.location?.[0] || 77
                },
                eventDate: new Date(disaster.date?.created),
                reportedDate: new Date(disaster.date?.created),
                severity: disaster.profile?.profile_severity || 'Moderate',
                verified: true,
                metadata: {
                    reliefWebId: disaster.id,
                    status: disaster.status,
                    sources: disaster.sources || [],
                    links: disaster.links || []
                }
            }));

            logger.info(`✅ ReliefWeb: ${events.length} events fetched`);
            return events;

        } catch (error) {
            logger.warn(`⚠️ ReliefWeb fetch failed: ${error.message}`);
            return [];
        }
    }

    /**
     * STRATEGY 3: Unified Sync - Combine + Deduplicate
     * 1. Fetch both APIs in parallel
     * 2. If both fail, use fallback data
     * 3. Merge data
     * 4. Remove duplicates by location + date proximity
     * 5. Upsert into database
     */
    async syncUnified() {
        try {
            logger.info('🔄 Starting unified disaster sync...');

            // Fetch both in parallel
            const [nasaEvents, reliefwebEvents] = await Promise.all([
                this.fetchNasaEonet(),
                this.fetchReliefWeb()
            ]);

            // Check if both failed, use fallback
            if (nasaEvents.length === 0 && reliefwebEvents.length === 0) {
                if (process.env.DISASTER_FALLBACK_ENABLED !== 'false') {
                    logger.warn('⚠️ Both APIs failed. Using fallback data.');
                    const fallback = this.getFallbackData();
                    const deduplicated = this._deduplicateByProximity(fallback);

                    const operations = deduplicated.map(event => ({
                        updateOne: {
                            filter: { externalId: event.externalId },
                            update: { $set: event },
                            upsert: true
                        }
                    }));

                    const result = await RealTimeEvent.bulkWrite(operations);
                    logger.info(`⚠️ Fallback data stored: ${fallback.length} events`);

                    return {
                        success: true,
                        nasa: 0,
                        reliefweb: 0,
                        fallback: fallback.length,
                        total: deduplicated.length,
                        upserted: result.upsertedCount,
                        updated: result.modifiedCount,
                        note: 'Using fallback data - APIs unavailable'
                    };
                } else {
                    return {
                        success: false,
                        error: 'Both APIs failed and fallback disabled',
                        nasa: 0,
                        reliefweb: 0
                    };
                }
            }

            logger.info(`📊 NASA: ${nasaEvents.length} | ReliefWeb: ${reliefwebEvents.length}`);

            // Combine events
            const allEvents = [...nasaEvents, ...reliefwebEvents];

            // Deduplicate by location proximity (within 50km) + date proximity (within 7 days)
            const deduplicated = this._deduplicateByProximity(allEvents, 50, 7);

            logger.info(`✅ After deduplication: ${deduplicated.length} unique events`);

            // Upsert to database
            const operations = deduplicated.map(event => ({
                updateOne: {
                    filter: { externalId: event.externalId },
                    update: { $set: event },
                    upsert: true
                }
            }));

            const result = await RealTimeEvent.bulkWrite(operations);

            logger.info(`📝 DB Updated: ${result.upsertedCount} new, ${result.modifiedCount} updated`);

            return {
                success: true,
                nasa: nasaEvents.length,
                reliefweb: reliefwebEvents.length,
                total: deduplicated.length,
                upserted: result.upsertedCount,
                updated: result.modifiedCount
            };

        } catch (error) {
            logger.error(`❌ Unified sync failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get incidents by source preference
     * Priority: ReliefWeb (verified) > NASA EONET (real-time)
     */
    async getIncidentsByPriority(days = 30, limit = 50) {
        try {
            const dateFrom = new Date();
            dateFrom.setDate(dateFrom.getDate() - days);

            // Fetch ReliefWeb first (verified, prioritized)
            const reliefwebEvents = await RealTimeEvent.find({
                source: 'ReliefWeb',
                eventDate: { $gte: dateFrom }
            })
                .sort({ eventDate: -1 })
                .limit(Math.ceil(limit * 0.6)); // 60% ReliefWeb

            // Fill remaining with NASA EONET
            const nasaEvents = await RealTimeEvent.find({
                source: 'NASA_EONET',
                eventDate: { $gte: dateFrom }
            })
                .sort({ eventDate: -1 })
                .limit(limit - reliefwebEvents.length);

            return {
                reliefweb: reliefwebEvents,
                nasa: nasaEvents,
                total: reliefwebEvents.length + nasaEvents.length
            };

        } catch (error) {
            logger.error(`Failed to get prioritized incidents: ${error.message}`);
            return { error: error.message };
        }
    }

    /**
     * Deduplicate events by geographic + temporal proximity
     */
    _deduplicateByProximity(events, radiusKm = 50, daysDiff = 7) {
        const seen = new Set();
        const unique = [];
        const R = 6371; // Earth radius in km

        for (const event of events) {
            let isDuplicate = false;

            for (const existing of unique) {
                // Calculate distance
                const distance = this._getDistance(
                    event.coordinates.latitude,
                    event.coordinates.longitude,
                    existing.coordinates.latitude,
                    existing.coordinates.longitude
                );

                // Calculate date difference
                const eventDate = new Date(event.eventDate);
                const existingDate = new Date(existing.eventDate);
                const daysDifference = Math.abs((eventDate - existingDate) / (1000 * 60 * 60 * 24));

                // If both location and date are close, it's a duplicate
                if (distance <= radiusKm && daysDifference <= daysDiff) {
                    isDuplicate = true;
                    // Prefer ReliefWeb (verified) over NASA
                    if (event.source === 'ReliefWeb' && existing.source === 'NASA_EONET') {
                        unique[unique.indexOf(existing)] = event;
                    }
                    break;
                }
            }

            if (!isDuplicate) {
                unique.push(event);
            }
        }

        return unique;
    }

    /**
     * Estimate severity from text
     */
    _estimateSeverity(text) {
        const lower = text.toLowerCase();
        if (lower.includes('catastrophic') || lower.includes('disaster') || lower.includes('massive')) {
            return 'Catastrophic';
        } else if (lower.includes('major') || lower.includes('large')) {
            return 'Major';
        } else if (lower.includes('moderate')) {
            return 'Moderate';
        }
        return 'Minor';
    }

    /**
     * Parse ReliefWeb location
     */
    _parseReliefWebLocation(disaster) {
        const coords = disaster.profile?.location;
        return {
            type: 'Point',
            coordinates: coords ? [coords[0], coords[1]] : [77, 20]
        };
    }

    /**
     * Haversine distance calculation
     */
    _getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}

module.exports = new UnifiedDisasterService();
