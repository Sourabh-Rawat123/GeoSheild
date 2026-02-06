import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Alerts = () => {
    const navigate = useNavigate();
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all'); // all, severe, high, moderate, low

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

    useEffect(() => {
        fetchAlerts();
    }, []);

    const fetchAlerts = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/alerts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAlerts(response.data.alerts || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to fetch alerts');
        } finally {
            setLoading(false);
        }
    };

    const sendTestAlert = async (channel) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/alerts/test`,
                { channel },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert(`✅ Test alert sent via ${channel}!`);
        } catch (err) {
            alert('❌ Failed to send test alert');
        }
    };

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'Severe': return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200';
            case 'High': return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900 dark:text-orange-200';
            case 'Moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200';
            case 'Low': return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-200';
        }
    };

    const getSeverityIcon = (severity) => {
        switch (severity) {
            case 'Severe': return '⛔';
            case 'High': return '🚨';
            case 'Moderate': return '⚠️';
            case 'Low': return '🟢';
            default: return '🔔';
        }
    };

    const filteredAlerts = filter === 'all'
        ? alerts
        : alerts.filter(a => a.severity.toLowerCase() === filter);

    const alertCounts = {
        severe: alerts.filter(a => a.severity === 'Severe').length,
        high: alerts.filter(a => a.severity === 'High').length,
        moderate: alerts.filter(a => a.severity === 'Moderate').length,
        low: alerts.filter(a => a.severity === 'Low').length,
    };

    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            {/* Hero Header */}
            <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl shadow-2xl p-8 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                            🔔 Alert Center
                        </h1>
                        <p className="text-orange-100 text-lg">
                            Real-time landslide risk notifications and warnings
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => sendTestAlert('email')}
                            className="px-4 py-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-lg font-semibold transition-all text-sm"
                        >
                            📧 Test Email
                        </button>
                        <button
                            onClick={() => sendTestAlert('sms')}
                            className="px-4 py-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-lg font-semibold transition-all text-sm"
                        >
                            📱 Test SMS
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard
                    label="Total Alerts"
                    value={alerts.length}
                    color="bg-gradient-to-br from-blue-500 to-blue-700"
                    active={filter === 'all'}
                    onClick={() => setFilter('all')}
                />
                <StatCard
                    label="Severe"
                    value={alertCounts.severe}
                    color="bg-gradient-to-br from-red-500 to-red-700"
                    icon="⛔"
                    active={filter === 'severe'}
                    onClick={() => setFilter('severe')}
                />
                <StatCard
                    label="High"
                    value={alertCounts.high}
                    color="bg-gradient-to-br from-orange-500 to-orange-700"
                    icon="🚨"
                    active={filter === 'high'}
                    onClick={() => setFilter('high')}
                />
                <StatCard
                    label="Moderate"
                    value={alertCounts.moderate}
                    color="bg-gradient-to-br from-yellow-500 to-yellow-700"
                    icon="⚠️"
                    active={filter === 'moderate'}
                    onClick={() => setFilter('moderate')}
                />
                <StatCard
                    label="Low"
                    value={alertCounts.low}
                    color="bg-gradient-to-br from-green-500 to-green-700"
                    icon="🟢"
                    active={filter === 'low'}
                    onClick={() => setFilter('low')}
                />
            </div>

            {loading ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-12 text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400 text-lg">Loading alerts...</p>
                </div>
            ) : error ? (
                <div className="bg-red-50 dark:bg-red-900/30 rounded-2xl shadow-xl p-8 border-2 border-red-300 dark:border-red-700">
                    <div className="flex items-center gap-4">
                        <span className="text-4xl">⚠️</span>
                        <div>
                            <h3 className="text-xl font-bold text-red-900 dark:text-red-200 mb-1">Error Loading Alerts</h3>
                            <p className="text-red-700 dark:text-red-300">{error}</p>
                        </div>
                    </div>
                </div>
            ) : filteredAlerts.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-12 text-center">
                    <div className="text-7xl mb-6">🔔</div>
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                        {filter === 'all' ? 'No Alerts Yet' : `No ${filter.charAt(0).toUpperCase() + filter.slice(1)} Alerts`}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-lg mb-6">
                        {filter === 'all'
                            ? "You'll receive notifications here when landslide risks are detected"
                            : `No ${filter} severity alerts at this time`
                        }
                    </p>
                    {filter !== 'all' && (
                        <button
                            onClick={() => setFilter('all')}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                        >
                            View All Alerts
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredAlerts.map((alert) => (
                        <div
                            key={alert.id}
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all p-6 border-l-8 transform hover:scale-[1.01]"
                            style={{
                                borderLeftColor:
                                    alert.severity === 'Severe' ? '#ef4444' :
                                        alert.severity === 'High' ? '#f97316' :
                                            alert.severity === 'Moderate' ? '#eab308' : '#22c55e'
                            }}
                        >
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    {/* Header */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="text-4xl">{getSeverityIcon(alert.severity)}</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className={`px-4 py-1.5 rounded-full text-sm font-bold border-2 ${getSeverityColor(alert.severity)}`}>
                                                    {alert.severity} Risk
                                                </span>
                                                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                                    {new Date(alert.timestamp).toLocaleString('en-IN', {
                                                        dateStyle: 'medium',
                                                        timeStyle: 'short'
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Message */}
                                    <p className="text-gray-800 dark:text-gray-200 text-lg mb-4 font-medium">
                                        {alert.message}
                                    </p>

                                    {/* Location & Delivery Info */}
                                    <div className="flex flex-wrap gap-4 text-sm">
                                        {alert.location && (
                                            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg">
                                                <span className="text-blue-600 dark:text-blue-400">📍</span>
                                                <span className="text-blue-900 dark:text-blue-200 font-medium">
                                                    {alert.location.latitude.toFixed(4)}, {alert.location.longitude.toFixed(4)}
                                                </span>
                                            </div>
                                        )}

                                        {alert.sent_via && alert.sent_via.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-600 dark:text-gray-400">Sent via:</span>
                                                <div className="flex gap-2">
                                                    {alert.sent_via.map((channel, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1"
                                                        >
                                                            {channel === 'email' ? '📧' : channel === 'sms' ? '📱' : '💬'}
                                                            {channel.toUpperCase()}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Action Button */}
                                <button
                                    onClick={() => navigate('/risk-map')}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm whitespace-nowrap"
                                    title="View on map"
                                >
                                    🗺️ View Map
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Info Section */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-lg p-8 border-2 border-blue-200 dark:border-blue-800">
                <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                    <span>ℹ️</span> About Alert System
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">How Alerts Work:</h4>
                        <ul className="space-y-2 text-sm text-blue-900 dark:text-blue-100">
                            <li className="flex items-start gap-2">
                                <span>•</span>
                                <span>Automatically triggered when High or Severe risk detected</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span>•</span>
                                <span>Real-time monitoring of your location and routes</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span>•</span>
                                <span>Multi-channel delivery (Email, SMS, WhatsApp)</span>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">Manage Alerts:</h4>
                        <ul className="space-y-2 text-sm text-blue-900 dark:text-blue-100">
                            <li className="flex items-start gap-2">
                                <span>•</span>
                                <span>Configure preferences in Profile settings</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span>•</span>
                                <span>Test delivery channels using buttons above</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span>•</span>
                                <span>Set custom risk thresholds for notifications</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ label, value, color, icon = '📊', active, onClick }) => (
    <button
        onClick={onClick}
        className={`${color} rounded-xl shadow-lg p-6 text-white hover:shadow-2xl transform hover:scale-105 transition-all ${active ? 'ring-4 ring-white ring-opacity-50' : ''
            }`}
    >
        <div className="text-3xl mb-2">{icon}</div>
        <div className="text-3xl font-bold mb-1">{value}</div>
        <div className="text-sm font-semibold text-white/90">{label}</div>
    </button>
);

export default Alerts;
