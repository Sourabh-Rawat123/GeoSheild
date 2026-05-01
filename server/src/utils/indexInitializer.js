/**
 * Database Index Initialization
 * Creates required indexes for geospatial queries
 */

const mongoose = require('mongoose');
const RealTimeEvent = require('../models/RealTimeEvent');
const HistoricalIncident = require('../models/HistoricalIncident');
const Prediction = require('../models/Prediction');
const logger = require('../utils/logger');

async function initializeIndexes() {
    try {
        logger.info('Initializing database indexes...');

        // RealTimeEvent indexes
        await RealTimeEvent.collection.createIndex({ 'location.coordinates': '2dsphere' });
        logger.info('✓ Created geospatial index for realtime_events.location.coordinates');

        await RealTimeEvent.collection.createIndex({ eventDate: -1 });
        logger.info('✓ Created index for realtime_events.eventDate');

        await RealTimeEvent.collection.createIndex({ source: 1, externalId: 1 }, { unique: true });
        logger.info('✓ Created unique index for realtime_events.source+externalId');

        // HistoricalIncident indexes
        await HistoricalIncident.collection.createIndex({ 'location.coordinates': '2dsphere' });
        logger.info('✓ Created geospatial index for historical_incidents.location.coordinates');

        // Prediction indexes
        await Prediction.collection.createIndex({ 'location.coordinates': '2dsphere' });
        logger.info('✓ Created geospatial index for predictions.location.coordinates');

        logger.info('✅ All database indexes created successfully');
        return true;

    } catch (error) {
        logger.error(`Index initialization failed: ${error.message}`);
        throw error;
    }
}

module.exports = { initializeIndexes };
