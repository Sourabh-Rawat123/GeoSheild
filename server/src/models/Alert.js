const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    predictionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prediction'
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    severity: {
        type: String,
        enum: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'],
        required: true
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: true
        },
        address: String
    },
    message: {
        type: String,
        required: true
    },
    sentVia: [{
        type: String,
        enum: ['email', 'sms', 'whatsapp']
    }],
    read: {
        type: Boolean,
        default: false
    },
    details: {
        probability: Number,
        riskLevel: String,
        apiScore: Number,
        mlScore: Number,
        historicalScore: Number
    }
}, {
    timestamps: true
});

// Index for geospatial queries
alertSchema.index({ location: '2dsphere' });

// Index for quick user alert lookups
alertSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('Alert', alertSchema);
