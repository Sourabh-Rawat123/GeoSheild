const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const data = require('./data.js');
const User = require('../models/User.js');
const HistoricalIncident = require('../models/HistoricalIncident.js');

const MONGO_URL = 'mongodb://localhost:27017/geoshield';

async function main() {
    await mongoose.connect(MONGO_URL);
    console.log('✓ MongoDB connection successful');
}

const initDB = async () => {
    try {
        // Clear existing users and incidents
        await User.deleteMany({});
        console.log('✓ Cleared existing users');

        await HistoricalIncident.deleteMany({});
        console.log('✓ Cleared existing historical incidents');

        // Insert admin user (password will be hashed by User model pre-save hook)
        const admin = await User.create(data.data);
        console.log(`✓ Inserted admin user: ${admin.email}`);

        // Insert historical incidents
        await HistoricalIncident.insertMany(data.historicalIncidents);
        console.log(`✓ Inserted ${data.historicalIncidents.length} historical incidents`);

        console.log('✓ Database seeded successfully');
        console.log('═══════════════════════════════════════');
        console.log('Admin Login:');
        console.log('Email: admin@geoshield.com');
        console.log('Password: admin123');
        console.log('═══════════════════════════════════════');
    } catch (err) {
        console.error('❌ Seeding failed:', err.message);
    } finally {
        process.exit();
    }
};

main()
    .then(initDB)
    .catch((err) => {
        console.error('❌ DB connection failed:', err);
        process.exit(1);
    });