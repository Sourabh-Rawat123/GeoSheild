const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true,
            validate: {
                validator: function (v) {
                    return v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90;
                },
                message: 'Invalid coordinates'
            }
        },
        address: String,
        city: String,
        state: String,
        country: String,
    },
    prediction: {
        probability: {
            type: Number,
            required: true,
            min: 0,
            max: 1,
        },
        riskLevel: {
            type: String,
            enum: ['Low', 'Moderate', 'High', 'Severe'],
            required: true,
        },
        confidence: {
            type: Number,
            min: 0,
            max: 1,
        },
    },
    features: {
        slope: Number,
        elevation: Number,
        rainfall: Number,
        soilMoisture: Number,
        landCover: String,
        distanceToRoad: Number,
        distanceToRiver: Number,
        geology: String,
    },
    weather: {
        currentRainfall: Number,
        forecast24h: Number,
        forecast72h: Number,
        temperature: Number,
        humidity: Number,
        windSpeed: Number,
    },
    mlModel: {
        name: String,
        version: String,
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'archived'],
        default: 'active',
    },
    validUntil: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
    // NEW: Track actual outcomes for model retraining
    outcome_verified: {
        type: Boolean,
        default: false,
    },
    actual_outcome: {
        type: Number, // 0 = no landslide, 1 = landslide occurred
        default: null,
    },
    outcome_reported_at: {
        type: Date,
        default: null,
    },
    outcome_reported_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});

// Indexes for geospatial queries
predictionSchema.index({ location: '2dsphere' });
predictionSchema.index({ userId: 1, createdAt: -1 });
predictionSchema.index({ 'prediction.riskLevel': 1 });

// Auto-expire old predictions
predictionSchema.index({ validUntil: 1 }, { expireAfterSeconds: 0 });

predictionSchema.methods.isExpired = function () {
    return new Date() > this.validUntil;
};

predictionSchema.methods.toPublicJSON = function () {
    return {
        id: this._id,
        location: this.location,
        prediction: this.prediction,
        features: this.features,
        weather: this.weather,
        createdAt: this.createdAt,
        validUntil: this.validUntil,
        status: this.status,
    };
};

const Prediction = mongoose.model('Prediction', predictionSchema);

module.exports = Prediction;
