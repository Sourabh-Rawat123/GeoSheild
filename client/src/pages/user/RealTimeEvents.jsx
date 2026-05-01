import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const RealTimeEvents = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [filter, setFilter] = useState('all'); // all, recent, nearby
    const [days, setDays] = useState(7);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

    useEffect(() => {
        fetchEvents();
        const interval = setInterval(fetchEvents, 3600000); // Refresh every hour
        return () => clearInterval(interval);
    }, [filter, days]);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            let response;

            if (filter === 'recent') {
                response = await axios.get(`${API_URL}/disasters/recent`, {
                    params: { days, limit: 50 }
                });
            } else if (filter === 'nearby') {
                const userCoords = getUserCoordinates();
                if (userCoords) {
                    response = await axios.get(`${API_URL}/disasters/nearby`, {
                        params: {
                            lat: userCoords.lat,
                            lon: userCoords.lon,
                            radius: 500
                        }
                    });
                } else {
                    toast.error('Location not available');
                    setFilter('recent');
                    return;
                }
            } else {
                response = await axios.get(`${API_URL}/disasters/recent`, {
                    params: { days: 30, limit: 100 }
                });
            }

            setEvents(response.data.events || []);

            // Fetch statistics
            const statsResponse = await axios.get(`${API_URL}/disasters/stats`, {
                params: { days }
            });
            setStats(statsResponse.data);
        } catch (error) {
            console.error('Failed to fetch events:', error);
            toast.error('Failed to load real-time events');
        } finally {
            setLoading(false);
        }
    };

    const getUserCoordinates = () => {
        // This would come from Redux user state in real app
        return { lat: 30.3165, lon: 78.0322 }; // Default to India center
    };

    const getSeverityColor = (severity) => {
        const colors = {
            'Minor': 'bg-yellow-100 text-yellow-800 border-yellow-300',
            'Moderate': 'bg-orange-100 text-orange-800 border-orange-300',
            'Major': 'bg-red-100 text-red-800 border-red-300',
            'Catastrophic': 'bg-red-900 text-red-100 border-red-700'
        };
        return colors[severity] || 'bg-gray-100 text-gray-800 border-gray-300';
    };

    const getSeverityIcon = (severity) => {
        const icons = {
            'Minor': '🟡',
            'Moderate': '🟠',
            'Major': '🔴',
            'Catastrophic': '⛔'
        };
        return icons[severity] || '⚪';
    };

    return (
        <div className="space-y-6 p-6 max-w-6xl mx-auto">
            {/* Hero Header */}
            <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl shadow-2xl p-8 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                            🌍 Real-Time Landslide Events
                        </h1>
                        <p className="text-red-100 text-lg">
                            Live landslide events tracked by NASA EONET
                        </p>
                    </div>
                    <div className="hidden md:block text-6xl">
                        🛰️
                    </div>
                </div>
            </div>

            {/* Statistics Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Total Events</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                        <p className="text-xs text-gray-500 mt-2">Last {stats.period}</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900 rounded-xl shadow p-6 border-l-4 border-red-500">
                        <p className="text-red-600 dark:text-red-200 text-sm mb-2">🔴 Major Events</p>
                        <p className="text-3xl font-bold text-red-900 dark:text-red-100">{stats.bySeverity?.Major || 0}</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900 rounded-xl shadow p-6 border-l-4 border-orange-500">
                        <p className="text-orange-600 dark:text-orange-200 text-sm mb-2">🟠 Moderate Events</p>
                        <p className="text-3xl font-bold text-orange-900 dark:text-orange-100">{stats.bySeverity?.Moderate || 0}</p>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900 rounded-xl shadow p-6 border-l-4 border-yellow-500">
                        <p className="text-yellow-600 dark:text-yellow-200 text-sm mb-2">🟡 Minor Events</p>
                        <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">{stats.bySeverity?.Minor || 0}</p>
                    </div>
                </div>
            )}

            {/* Filter Controls */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                <div className="flex flex-wrap gap-4 items-center">
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</label>
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'all'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                All Events
                            </button>
                            <button
                                onClick={() => setFilter('recent')}
                                className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'recent'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                Recent
                            </button>
                            <button
                                onClick={() => setFilter('nearby')}
                                className={`px-4 py-2 rounded-lg font-medium transition ${filter === 'nearby'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                Nearby
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Time Range:</label>
                        <select
                            value={days}
                            onChange={(e) => setDays(parseInt(e.target.value))}
                            className="mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        >
                            <option value={7}>Last 7 days</option>
                            <option value={14}>Last 14 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                        </select>
                    </div>

                    <button
                        onClick={fetchEvents}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium ml-auto"
                    >
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* Events List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                        <p className="text-gray-600 dark:text-gray-400">Loading real-time events...</p>
                    </div>
                ) : events.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
                        <p className="text-gray-600 dark:text-gray-400">No events found in this timeframe</p>
                    </div>
                ) : (
                    events.map((event) => (
                        <div
                            key={event.id}
                            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition p-6 border-l-4"
                            style={{
                                borderLeftColor:
                                    event.severity === 'Catastrophic' ? '#7f1d1d' :
                                        event.severity === 'Major' ? '#dc2626' :
                                            event.severity === 'Moderate' ? '#ea580c' : '#eab308'
                            }}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-2xl">{getSeverityIcon(event.severity)}</span>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                            {event.title}
                                        </h3>
                                    </div>
                                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getSeverityColor(event.severity)}`}>
                                        {event.severity} Severity
                                    </span>
                                </div>
                                <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                                    <p>{new Date(event.eventDate).toLocaleDateString()}</p>
                                    <p>{new Date(event.eventDate).toLocaleTimeString()}</p>
                                </div>
                            </div>

                            <div className="space-y-2 text-sm">
                                {event.description && (
                                    <p className="text-gray-700 dark:text-gray-300">{event.description}</p>
                                )}
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                    <span>📍</span>
                                    <span>
                                        {event.location.latitude.toFixed(4)}°, {event.location.longitude.toFixed(4)}°
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                    <span>🔗</span>
                                    <span>Source: {event.source}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default RealTimeEvents;
