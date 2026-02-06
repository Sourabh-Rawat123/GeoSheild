const mongoose = require('mongoose');

const historicalIncidentSchema = new mongoose.Schema({
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true,
        },
        address: String,
        city: String,
        state: String,
        country: String,
    },
    incidentDate: {
        type: Date,
        required: true,
    },
    severity: {
        type: String,
        enum: ['Minor', 'Moderate', 'Major', 'Catastrophic'],
        required: true,
    },
    details: {
        casualties: {
            deaths: { type: Number, default: 0 },
            injuries: { type: Number, default: 0 },
        },
        damage: {
            housesDestroyed: { type: Number, default: 0 },
            roadsBlocked: { type: Number, default: 0 },
            estimatedCost: Number, // in local currency
        },
        area: {
            affectedAreaKm2: Number,
            volumeM3: Number,
        },
    },
    triggers: {
        rainfall: Number, // mm in 24h before incident
        earthquake: Boolean,
        humanActivity: Boolean,
        other: String,
    },
    conditions: {
        slope: Number,
        soilType: String,
        vegetation: String,
        previousSlides: Boolean,
    },
    description: {
        type: String,
        maxlength: 2000,
    },
    source: {
        type: String,
        enum: ['official', 'news', 'research', 'community', 'sensor'],
        default: 'official',
    },
    verified: {
        type: Boolean,
        default: false,
    },
    images: [{
        url: String,
        caption: String,
        uploadedAt: Date,
    }],
    reportedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
});

// Indexes
historicalIncidentSchema.index({ location: '2dsphere' });
historicalIncidentSchema.index({ incidentDate: -1 });
historicalIncidentSchema.index({ severity: 1 });
historicalIncidentSchema.index({ verified: 1 });

// Method to get nearby incidents
historicalIncidentSchema.statics.findNearby = async function (longitude, latitude, radiusKm = 50) {
    return this.find({
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [longitude, latitude]
                },
                $maxDistance: radiusKm * 1000 // convert to meters
            }
        }
    }).sort({ incidentDate: -1 });
};

// Method to get recent incidents
historicalIncidentSchema.statics.findRecent = async function (months = 12) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    return this.find({
        incidentDate: { $gte: startDate }
    }).sort({ incidentDate: -1 });
};

historicalIncidentSchema.methods.toPublicJSON = function () {
    return {
        id: this._id,
        location: this.location,
        incidentDate: this.incidentDate,
        severity: this.severity,
        details: this.details,
        triggers: this.triggers,
        description: this.description,
        verified: this.verified,
        createdAt: this.createdAt,
    };
};

const HistoricalIncident = mongoose.model('HistoricalIncident', historicalIncidentSchema);

module.exports = HistoricalIncident;
