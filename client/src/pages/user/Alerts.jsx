import { useEffect, useState } from 'react';
import axios from 'axios';

const Alerts = () => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
            alert(`Test alert sent via ${channel}!`);
        } catch (err) {
            alert('Failed to send test alert');
        }
    };

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'Severe': return 'bg-red-100 text-red-800 border-red-300';
            case 'High': return 'bg-orange-100 text-orange-800 border-orange-300';
            case 'Moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'Low': return 'bg-green-100 text-green-800 border-green-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Alert History
                </h1>

                {/* Test Alert Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={() => sendTestAlert('email')}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                    >
                        📧 Test Email
                    </button>
                    <button
                        onClick={() => sendTestAlert('sms')}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                    >
                        📱 Test SMS
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading alerts...</p>
                </div>
            ) : error ? (
                <div className="bg-red-50 dark:bg-red-900 rounded-lg shadow-lg p-6">
                    <p className="text-red-600 dark:text-red-200">⚠️ {error}</p>
                </div>
            ) : alerts.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
                    <div className="text-6xl mb-4">🔔</div>
                    <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        No Alerts Yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                        You'll see notifications here when landslide risks are detected in your monitored areas.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {alerts.map((alert) => (
                        <div
                            key={alert.id}
                            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 hover:shadow-xl transition-shadow"
                            style={{
                                borderLeftColor: alert.severity === 'High' ? '#f97316' :
                                    alert.severity === 'Severe' ? '#ef4444' :
                                        alert.severity === 'Moderate' ? '#eab308' : '#22c55e'
                            }}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${getSeverityColor(alert.severity)}`}>
                                            {alert.severity} Risk
                                        </span>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(alert.timestamp).toLocaleString()}
                                        </span>
                                    </div>

                                    <p className="text-gray-800 dark:text-gray-200 text-lg mb-3">
                                        {alert.message}
                                    </p>

                                    {alert.location && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                                            <span>📍</span>
                                            <span>
                                                Lat: {alert.location.latitude.toFixed(4)},
                                                Lon: {alert.location.longitude.toFixed(4)}
                                            </span>
                                        </div>
                                    )}

                                    {alert.sent_via && alert.sent_via.length > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                            <span>Sent via:</span>
                                            <div className="flex gap-2">
                                                {alert.sent_via.map((channel, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs"
                                                    >
                                                        {channel === 'email' ? '📧' : channel === 'sms' ? '📱' : '💬'} {channel}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    className="ml-4 text-blue-500 hover:text-blue-600 dark:text-blue-400"
                                    title="View on map"
                                >
                                    🗺️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Info Section */}
            <div className="mt-8 bg-blue-50 dark:bg-blue-900 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
                    📋 About Alerts
                </h3>
                <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                    <li>• Alerts are triggered when High or Severe risk levels are detected</li>
                    <li>• You can configure alert preferences in your Profile settings</li>
                    <li>• Alerts can be sent via Email, SMS, or WhatsApp (when configured)</li>
                    <li>• Test your alert channels using the buttons above</li>
                </ul>
            </div>
        </div>
    );
};

export default Alerts;
