/**
 * Sample Admin User
 * NOTE: All incident data has been removed. Data should be fetched from:
 * - NASA EONET API: https://eonet.gsfc.nasa.gov/api/v3/events
 * - ReliefWeb API: https://reliefweb.int/api/v1/disasters
 * - Use /api/incidents/seed-test endpoint to populate data
 */
const sampleAdmin = {
    name: 'Admin User',
    email: 'admin@geoshield.com',
    password: 'admin123',
    role: 'admin',
    location: {
        coordinates: [78.0322, 30.3165],
        address: 'Rajpur Road',
        city: 'Dehradun',
        state: 'Uttarakhand'
    },
    alertPreferences: {
        sms: {
            enabled: false,
            phone: '7456931978'
        },
        severityThreshold: 'Moderate'
    }
};

/**
 * Historical incidents are now fetched from external APIs
 * Empty array for initialization - populate using API endpoints
 */
const historicalIncidents = [];

module.exports = { data: sampleAdmin, historicalIncidents };