const mongoose = require('mongoose');

const realTimeEventSchema = new mongoose.Schema(
    {
        externalId: {
            type: String,
            unique: true,
            required: true,
            index: true
        },
        source: {
            type: String,
            enum: ['NASA_EONET', 'GSI', 'NRSC', 'USER_REPORT'],
            default: 'NASA_EONET'
        },
        title: {
            type: String,
            required: true
        },
        description: String,
        location: {
            type: {
                type: String,
                enum: ['Point'],
                required: true
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                required: true
            }
        },
        coordinates: {
            latitude: Number,
            longitude: Number
        },
        eventDate: {
            type: Date,
            required: true,
            index: true
        },
        reportedDate: {
            type: Date,
            default: Date.now,
            index: true
        },
        severity: {
            type: String,
            enum: ['Minor', 'Moderate', 'Major', 'Catastrophic'],
            default: 'Moderate',
            index: true
        },
        status: {
            type: String,
            enum: ['ACTIVE', 'CLOSED', 'PREDICTED'],
            default: 'ACTIVE'
        },
        metadata: {
            eventId: String,
            title: String,
            category: String,
            sources: [String],
            links: [String],
            additionalInfo: mongoose.Schema.Types.Mixed
        },
        verified: {
            type: Boolean,
            default: false
        },
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        casualties: {
            deaths: { type: Number, default: 0 },
            injured: { type: Number, default: 0 },
            displaced: { type: Number, default: 0 }
        },
        impact: {
            damageEstimate: String,
            affectedAreas: [String],
            infrastructure: String
        }
    },
    {
        timestamps: true,
        collection: 'realtime_events'
    }
);

// Indexes for efficient querying
realTimeEventSchema.index({ location: '2dsphere' });
realTimeEventSchema.index({ eventDate: -1 });
realTimeEventSchema.index({ severity: 1, eventDate: -1 });
realTimeEventSchema.index({ source: 1, externalId: 1 }, { unique: true });

// Methods
realTimeEventSchema.methods.toPublicJSON = function () {
    return {
        id: this._id,
        title: this.title,
        description: this.description,
        location: {
            coordinates: this.location.coordinates,
            latitude: this.coordinates.latitude,
            longitude: this.coordinates.longitude
        },
        eventDate: this.eventDate,
        reportedDate: this.reportedDate,
        severity: this.severity,
        source: this.source,
        verified: this.verified,
        metadata: this.metadata
    };
};

realTimeEventSchema.statics.findNearby = async function (longitude, latitude, radiusKm = 100) {
    const radiusMeters = radiusKm * 1000;
    return this.find({
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [longitude, latitude]
                },
                $maxDistance: radiusMeters
            }
        }
    });
};

realTimeEventSchema.statics.findRecent = async function (days = 30) {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    return this.find({ eventDate: { $gte: dateFrom } })
        .sort({ eventDate: -1 });
};

module.exports = mongoose.model('RealTimeEvent', realTimeEventSchema);
