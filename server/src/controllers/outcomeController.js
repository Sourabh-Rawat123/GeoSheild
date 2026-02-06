/**
 * Outcome Reporting Controller
 * Users and admins report actual landslide occurrences
 * This data feeds back into model retraining
 */
const Prediction = require('../models/Prediction');
const HistoricalIncident = require('../models/HistoricalIncident');
const asyncHandler = require('../utils/async_handler');
const ApiError = require('../utils/api_error');
const logger = require('../utils/logger');

/**
 * @desc    Report actual outcome for a prediction
 * @route   POST /api/predictions/:id/outcome
 * @access  Private (User/Admin)
 */
exports.reportOutcome = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { landslide_occurred, severity, description } = req.body;

    // Find the prediction
    const prediction = await Prediction.findById(id);
    if (!prediction) {
        throw new ApiError('Prediction not found', 404);
    }

    // Check if user has permission (owner or admin)
    if (prediction.userId.toString() !== req.user.id && req.user.role !== 'admin') {
        throw new ApiError('Not authorized to report outcome for this prediction', 403);
    }

    // Update prediction with actual outcome
    prediction.outcome_verified = true;
    prediction.actual_outcome = landslide_occurred ? 1 : 0;
    prediction.outcome_reported_at = new Date();
    prediction.outcome_reported_by = req.user.id;

    await prediction.save();

    logger.info(`Outcome reported for prediction ${id}: ${landslide_occurred ? 'OCCURRED' : 'DID NOT OCCUR'}`);

    // If landslide actually occurred, create historical incident
    if (landslide_occurred) {
        const incident = new HistoricalIncident({
            location: prediction.location,
            incidentDate: new Date(),
            severity: severity || 'Moderate',
            description: description || 'User-reported landslide event',
            source: 'community',
            verified: req.user.role === 'admin',
            reportedBy: req.user.id,
            triggers: {
                rainfall: prediction.weather?.currentRainfall || 0,
            },
            conditions: {
                slope: prediction.features?.slope || 0,
            }
        });

        await incident.save();
        logger.info(`Historical incident created from prediction ${id}`);
    }

    // Calculate model accuracy
    const totalVerified = await Prediction.countDocuments({ outcome_verified: true });
    const correctPredictions = await Prediction.countDocuments({
        outcome_verified: true,
        $expr: {
            $eq: [
                '$actual_outcome',
                {
                    $cond: [
                        { $gte: ['$prediction.probability', 0.5] },
                        1,
                        0
                    ]
                }
            ]
        }
    });

    const accuracy = totalVerified > 0 ? (correctPredictions / totalVerified * 100).toFixed(2) : 0;

    res.json({
        success: true,
        message: 'Outcome reported successfully',
        prediction: {
            id: prediction._id,
            predicted_risk: prediction.prediction.riskLevel,
            predicted_probability: prediction.prediction.probability,
            actual_outcome: landslide_occurred ? 'Landslide occurred' : 'No landslide',
            correct: (prediction.prediction.probability >= 0.5) === landslide_occurred
        },
        model_stats: {
            total_verified_predictions: totalVerified,
            correct_predictions: correctPredictions,
            current_accuracy: `${accuracy}%`
        }
    });
});

/**
 * @desc    Get predictions needing outcome verification
 * @route   GET /api/predictions/pending-verification
 * @access  Private
 */
exports.getPendingVerification = asyncHandler(async (req, res) => {
    // Get predictions made 24-72 hours ago (enough time to verify)
    const startDate = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const endDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const predictions = await Prediction.find({
        userId: req.user.id,
        outcome_verified: false,
        createdAt: { $gte: startDate, $lte: endDate },
        'prediction.probability': { $gte: 0.3 } // Only ask for moderate+ predictions
    })
        .sort({ createdAt: -1 })
        .limit(10);

    res.json({
        success: true,
        count: predictions.length,
        message: 'Please verify if landslides occurred at these predicted locations',
        predictions: predictions.map(p => ({
            id: p._id,
            location: p.location,
            predicted_risk: p.prediction.riskLevel,
            probability: p.prediction.probability,
            predicted_at: p.createdAt,
            hours_ago: Math.floor((Date.now() - p.createdAt) / (1000 * 60 * 60))
        }))
    });
});

module.exports = exports;
