import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSinglePrediction } from '@features/predictions/predictionsSlice';

const UserDashboard = () => {
    const dispatch = useDispatch();
    const { user } = useSelector((state) => state.auth);
    const { currentPrediction, isLoading } = useSelector((state) => state.predictions);

    useEffect(() => {
        // Fetch prediction for user's location on mount
        if (user?.location?.coordinates) {
            const [lon, lat] = user.location.coordinates;
            console.log('🔍 Dashboard: Fetching prediction for location:', { lat, lon });
            dispatch(fetchSinglePrediction({ latitude: lat, longitude: lon }));
        } else {
            console.warn('⚠️ Dashboard: No user location set. Go to Profile to set location.');
        }
    }, [dispatch, user]);

    // Debug log the prediction data
    useEffect(() => {
        console.log('📊 Dashboard Prediction Data:', {
            isLoading,
            hasPrediction: !!currentPrediction,
            prediction: currentPrediction?.prediction,
            breakdown: currentPrediction?.breakdown
        });
    }, [currentPrediction, isLoading]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Welcome back, {user?.name}!
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Your landslide risk assessment dashboard
                </p>
            </div>

            {/* Risk Summary Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                    Current Risk Assessment
                </h2>

                {isLoading ? (
                    <div className="flex items-center justify-center h-48">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                    </div>
                ) : currentPrediction?.prediction ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Risk Level:</span>
                            <span className={`text-2xl font-bold ${getRiskColor(currentPrediction.prediction.riskLevel)}`}>
                                {currentPrediction.prediction.riskLevel}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Probability:</span>
                            <span className="text-xl font-semibold text-gray-900 dark:text-white">
                                {(currentPrediction.prediction.probability * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Confidence:</span>
                            <span className="text-xl font-semibold text-gray-900 dark:text-white">
                                {(currentPrediction.prediction.confidence * 100).toFixed(1)}%
                            </span>
                        </div>

                        {/* Breakdown Details */}
                        {currentPrediction.breakdown && (
                            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Risk Assessment Breakdown</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Weather & Environment (50%):</span>
                                        <span className="font-semibold">{(currentPrediction.breakdown.api.contribution * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">ML Model Analysis (40%):</span>
                                        <span className="font-semibold">{(currentPrediction.breakdown.ml.contribution * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Historical Data (10%):</span>
                                        <span className="font-semibold">{(currentPrediction.breakdown.historical.contribution * 100).toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-gray-500 dark:text-gray-400">
                        No prediction data available. Set your location in profile settings.
                    </p>
                )}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total Predictions" value="0" trend="No data" />
                <StatCard title="Alerts Sent" value="0" trend="No alerts" />
                <StatCard title="Days Monitored" value="0" trend="Not started" />
            </div>

            {/* Recent Alerts */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                    Recent Alerts
                </h2>
                <p className="text-gray-500 dark:text-gray-400">No alerts yet. Start monitoring your location to receive risk alerts.</p>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, trend }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-sm text-green-600 dark:text-green-400 mt-2">{trend}</p>
    </div>
);

const getRiskColor = (level) => {
    const colors = {
        'Very Low': 'text-green-600',
        'Low': 'text-blue-600',
        'Moderate': 'text-yellow-600',
        'High': 'text-orange-600',
        'Severe': 'text-red-600',
    };
    return colors[level] || 'text-gray-600';
};

export default UserDashboard;
