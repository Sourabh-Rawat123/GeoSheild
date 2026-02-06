import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchSinglePrediction } from '@features/predictions/predictionsSlice';
import { updateUser } from '@features/auth/authSlice';
import authService from '@services/authService';
import toast from 'react-hot-toast';

const UserDashboard = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);
    const { currentPrediction, isLoading } = useSelector((state) => state.predictions);
    const [requestingLocation, setRequestingLocation] = useState(false);

    useEffect(() => {
        if (user?.location?.coordinates &&
            Array.isArray(user.location.coordinates) &&
            user.location.coordinates.length === 2 &&
            user.location.coordinates[0] &&
            user.location.coordinates[1]) {
            const [lon, lat] = user.location.coordinates;
            console.log('Dashboard: Fetching prediction for:', { lat, lon, location: user.location });

            // Extra validation to ensure lat/lon are valid numbers
            if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                dispatch(fetchSinglePrediction({ latitude: lat, longitude: lon }));
            } else {
                console.error('Dashboard: Invalid coordinates:', { lat, lon });
            }
        } else {
            console.log('Dashboard: No valid location set in user profile', user?.location);
        }
    }, [dispatch, user?.location?.coordinates]);

    const handleSetLocation = async () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            return;
        }

        setRequestingLocation(true);
        toast.loading('Requesting location access...', { id: 'location-request' });

        // Check permission status first
        if (navigator.permissions) {
            try {
                const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
                if (permissionStatus.state === 'denied') {
                    toast.dismiss('location-request');
                    toast.error('Location access denied. To enable:\n1. Click the 🔒 icon in address bar\n2. Allow Location\n3. Refresh this page', { duration: 8000 });
                    setRequestingLocation(false);
                    return;
                }
            } catch (err) {
                console.log('Permission API not available');
            }
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;

                    // Reverse geocode
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                        { headers: { 'User-Agent': 'GeoShield-App' } }
                    );
                    const data = await response.json();

                    const city = data.address?.city || data.address?.town || data.address?.village || 'Unknown';
                    const state = data.address?.state || 'Unknown';
                    const address = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

                    // Update profile
                    const updatedUser = await authService.updateProfile({
                        location: {
                            type: 'Point',
                            coordinates: [longitude, latitude],
                            address,
                            city,
                            state,
                        },
                    });

                    dispatch(updateUser(updatedUser));
                    toast.success(`Location set: ${city}, ${state}`, { id: 'location-request' });
                } catch (err) {
                    console.error('Failed to update location:', err);
                    toast.dismiss('location-request');
                    toast.error('Failed to save location. Please try again.');
                } finally {
                    setRequestingLocation(false);
                }
            },
            (error) => {
                console.error('Geolocation error:', error.code, error.message);
                toast.dismiss('location-request');

                if (error.code === 1) {
                    toast.error('Location access denied. To enable:\n1. Click the 🔒 icon in address bar\n2. Allow Location\n3. Try again', { duration: 8000 });
                } else if (error.code === 2) {
                    toast.error('Location unavailable. Please check your device settings.');
                } else if (error.code === 3) {
                    toast.error('Location request timed out. Please try again.');
                } else {
                    toast.error('Failed to get location. Please try again.');
                }
                setRequestingLocation(false);
            },
            { timeout: 20000, enableHighAccuracy: true, maximumAge: 0 }
        );
    };

    const getRiskIcon = (level) => {
        const icons = {
            'Very Low': '✅',
            'Low': '🟢',
            'Moderate': '🟡',
            'High': '🟠',
            'Severe': '🔴',
        };
        return icons[level] || '⚪';
    };

    const getRiskGradient = (level) => {
        const gradients = {
            'Very Low': 'from-green-400 to-green-600',
            'Low': 'from-blue-400 to-blue-600',
            'Moderate': 'from-yellow-400 to-yellow-600',
            'High': 'from-orange-400 to-orange-600',
            'Severe': 'from-red-500 to-red-700',
        };
        return gradients[level] || 'from-gray-400 to-gray-600';
    };

    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-2xl p-8 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">
                            Welcome, {user?.name}! 👋
                        </h1>
                        <p className="text-blue-100 text-lg">
                            Real-time landslide risk assessment for your location
                        </p>
                    </div>
                    <div className="hidden md:block text-6xl">
                        🏔️
                    </div>
                </div>
            </div>

            {/* Main Risk Assessment Card */}
            {isLoading ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-12">
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
                        <p className="text-gray-600 dark:text-gray-400 text-lg">Analyzing your location...</p>
                    </div>
                </div>
            ) : currentPrediction?.prediction ? (
                <div className={`bg-gradient-to-br ${getRiskGradient(currentPrediction.prediction.riskLevel)} rounded-2xl shadow-2xl p-8 text-white transform hover:scale-[1.02] transition-transform`}>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold">Current Risk Status</h2>
                        <span className="text-6xl">{getRiskIcon(currentPrediction.prediction.riskLevel)}</span>
                    </div>

                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-6">
                        <div className="text-center">
                            <p className="text-sm font-semibold text-white/80 mb-2">RISK LEVEL</p>
                            <p className="text-5xl font-bold mb-4">{currentPrediction.prediction.riskLevel}</p>

                            <div className="grid grid-cols-2 gap-4 mt-6">
                                <div className="bg-white/10 rounded-lg p-4">
                                    <p className="text-xs text-white/70 mb-1">Probability</p>
                                    <p className="text-2xl font-bold">{(currentPrediction.prediction.probability * 100).toFixed(1)}%</p>
                                </div>
                                <div className="bg-white/10 rounded-lg p-4">
                                    <p className="text-xs text-white/70 mb-1">Confidence</p>
                                    <p className="text-2xl font-bold">{(currentPrediction.prediction.confidence * 100).toFixed(1)}%</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI Analysis Breakdown */}
                    {currentPrediction.breakdown && (
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                <span>🤖</span> AI Analysis Breakdown
                            </h3>

                            <div className="space-y-2">
                                <BreakdownBar
                                    label="Live Weather & Environment"
                                    value={currentPrediction.breakdown.api.contribution * 100}
                                    weight="50%"
                                    icon="🌤️"
                                />
                                <BreakdownBar
                                    label="Machine Learning Model"
                                    value={currentPrediction.breakdown.ml.contribution * 100}
                                    weight="40%"
                                    icon="🧠"
                                />
                                <BreakdownBar
                                    label="Historical Data Analysis"
                                    value={currentPrediction.breakdown.historical.contribution * 100}
                                    weight="10%"
                                    icon="📊"
                                />
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-12 text-center">
                    <div className="text-6xl mb-4">📍</div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        No Location Set
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Allow location access to start monitoring landslide risks
                    </p>
                    <button
                        onClick={handleSetLocation}
                        disabled={requestingLocation}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {requestingLocation ? '⏳ Requesting Location...' : '📍 Allow Location Access'}
                    </button>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                        Or set it manually in{' '}
                        <button
                            onClick={() => navigate('/profile')}
                            className="text-blue-600 hover:text-blue-700 underline"
                        >
                            Profile
                        </button>
                    </p>
                </div>
            )}

            {/* Quick Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <ActionCard
                    icon="🗺️"
                    title="Risk Map"
                    description="View real-time risk zones"
                    onClick={() => navigate('/risk-map')}
                    color="bg-gradient-to-br from-purple-500 to-purple-700"
                />
                <ActionCard
                    icon="🛣️"
                    title="Route Analysis"
                    description="Check your travel route"
                    onClick={() => navigate('/route-analysis')}
                    color="bg-gradient-to-br from-blue-500 to-blue-700"
                />
                <ActionCard
                    icon="🔔"
                    title="Alerts"
                    description="View notifications"
                    onClick={() => navigate('/alerts')}
                    color="bg-gradient-to-br from-orange-500 to-orange-700"
                />
                <ActionCard
                    icon="👤"
                    title="Profile"
                    description="Update preferences"
                    onClick={() => navigate('/profile')}
                    color="bg-gradient-to-br from-green-500 to-green-700"
                />
            </div>

            {/* Safety Tips */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-lg p-6 border-2 border-amber-200 dark:border-amber-800">
                <h3 className="text-xl font-bold text-amber-900 dark:text-amber-200 mb-4 flex items-center gap-2">
                    <span>⚠️</span> Landslide Safety Tips
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SafetyTip text="Monitor weather forecasts during monsoon season" />
                    <SafetyTip text="Avoid travel during heavy rainfall" />
                    <SafetyTip text="Stay alert for unusual ground cracks or slope changes" />
                    <SafetyTip text="Have an emergency evacuation plan ready" />
                </div>
            </div>
        </div>
    );
};

const BreakdownBar = ({ label, value, weight, icon }) => (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
        <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium flex items-center gap-2">
                <span>{icon}</span> {label}
            </span>
            <span className="text-xs bg-white/20 px-2 py-1 rounded">Weight: {weight}</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-3">
            <div
                className="bg-white rounded-full h-3 transition-all duration-500"
                style={{ width: `${value}%` }}
            />
        </div>
        <p className="text-right text-sm mt-1 font-semibold">{value.toFixed(1)}%</p>
    </div>
);

const ActionCard = ({ icon, title, description, onClick, color }) => (
    <button
        onClick={onClick}
        className={`${color} rounded-xl shadow-lg p-6 text-white hover:shadow-2xl transform hover:scale-105 transition-all text-left`}
    >
        <div className="text-4xl mb-3">{icon}</div>
        <h3 className="font-bold text-lg mb-1">{title}</h3>
        <p className="text-sm text-white/80">{description}</p>
    </button>
);

const SafetyTip = ({ text }) => (
    <div className="flex items-start gap-3 bg-white dark:bg-gray-800 rounded-lg p-3">
        <span className="text-amber-600 dark:text-amber-400 mt-0.5">✓</span>
        <p className="text-sm text-gray-700 dark:text-gray-300">{text}</p>
    </div>
);

export default UserDashboard;
