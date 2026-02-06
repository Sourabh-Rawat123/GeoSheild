import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import axios from 'axios';

const RouteAnalysis = () => {
    const { user } = useSelector((state) => state.auth);
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [routeData, setRouteData] = useState(null);
    const [riskAnalysis, setRiskAnalysis] = useState(null);

    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const routingControlRef = useRef(null);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

    // Initialize map
    useEffect(() => {
        if (!mapInstanceRef.current && mapRef.current) {
            const map = L.map(mapRef.current).setView([20.5937, 78.9629], 5); // Center of India

            const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
            if (mapboxToken && mapboxToken !== 'pk.your_mapbox_token_here_optional') {
                L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`, {
                    attribution: '© Mapbox © OpenStreetMap',
                    tileSize: 512,
                    zoomOffset: -1,
                    maxZoom: 19,
                }).addTo(map);
            } else {
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 19,
                }).addTo(map);
            }

            mapInstanceRef.current = map;
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    const analyzeRoute = async () => {
        if (!origin || !destination) {
            alert('Please enter both origin and destination');
            return;
        }

        setAnalyzing(true);
        setRouteData(null);
        setRiskAnalysis(null);

        try {
            // Remove existing route
            if (routingControlRef.current && mapInstanceRef.current) {
                mapInstanceRef.current.removeControl(routingControlRef.current);
                routingControlRef.current = null;
            }

            // Geocode origin and destination
            const originCoords = await geocode(origin);
            const destCoords = await geocode(destination);

            if (!originCoords || !destCoords) {
                throw new Error('Could not find one or both locations');
            }

            // Create route
            const routing = L.Routing.control({
                waypoints: [
                    L.latLng(originCoords.lat, originCoords.lon),
                    L.latLng(destCoords.lat, destCoords.lon)
                ],
                router: L.Routing.osrmv1({
                    serviceUrl: 'https://router.project-osrm.org/route/v1'
                }),
                lineOptions: {
                    styles: [{ color: '#3b82f6', weight: 6, opacity: 0.7 }]
                },
                createMarker: function (i, waypoint, n) {
                    return L.marker(waypoint.latLng, {
                        icon: L.divIcon({
                            className: 'route-marker',
                            html: `<div style="background: ${i === 0 ? '#22c55e' : '#ef4444'}; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">${i === 0 ? 'A' : 'B'}</div>`,
                            iconSize: [28, 28]
                        })
                    });
                }
            }).addTo(mapInstanceRef.current);

            routingControlRef.current = routing;

            // Get route data and analyze risks
            routing.on('routesfound', async function (e) {
                const route = e.routes[0];
                const routeCoords = route.coordinates;
                const summary = route.summary;

                setRouteData({
                    distance: (summary.totalDistance / 1000).toFixed(2),
                    duration: Math.round(summary.totalTime / 60),
                    coordinates: routeCoords
                });

                // Fetch predictions and analyze route risk
                const token = localStorage.getItem('token');
                const predictions = await axios.get(`${API_URL}/predictions/active`, {
                    params: {
                        lat: (originCoords.lat + destCoords.lat) / 2,
                        lon: (originCoords.lon + destCoords.lon) / 2,
                        radius: 200
                    },
                    headers: { Authorization: `Bearer ${token}` }
                });

                const riskZones = analyzeRouteRisk(routeCoords, predictions.data.predictions || []);
                setRiskAnalysis(riskZones);

                // Add risk markers
                riskZones.highRiskPoints.forEach(point => {
                    L.circleMarker([point.lat, point.lon], {
                        radius: 8,
                        fillColor: '#ef4444',
                        color: '#fff',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.7
                    }).addTo(mapInstanceRef.current)
                        .bindPopup(`<strong>⚠️ High Risk Zone</strong><br/>Risk Level: ${point.riskLevel}<br/>Distance from route: ${point.distance}m`);
                });
            });

        } catch (error) {
            console.error('Route analysis error:', error);
            alert('Failed to analyze route: ' + error.message);
        } finally {
            setAnalyzing(false);
        }
    };

    const geocode = async (address) => {
        try {
            const response = await axios.get(`https://nominatim.openstreetmap.org/search`, {
                params: {
                    q: address,
                    format: 'json',
                    limit: 1,
                    countrycodes: 'in'
                },
                headers: {
                    'User-Agent': 'GeoShield-Landslide-Prevention/1.0'
                }
            });

            if (response.data && response.data.length > 0) {
                return {
                    lat: parseFloat(response.data[0].lat),
                    lon: parseFloat(response.data[0].lon)
                };
            }
            return null;
        } catch (error) {
            console.error('Geocoding error:', error);
            return null;
        }
    };

    const analyzeRouteRisk = (routeCoords, predictions) => {
        const highRiskPoints = [];
        const moderateRiskPoints = [];
        let maxRisk = 'Low';
        let totalRiskScore = 0;

        predictions.forEach(pred => {
            if (!pred.location?.coordinates) return;

            const [predLon, predLat] = pred.location.coordinates;
            const riskLevel = pred.prediction.riskLevel;

            routeCoords.forEach(coord => {
                const distance = getDistance(predLat, predLon, coord.lat, coord.lng);

                if (distance < 5000) { // Within 5km
                    const point = {
                        lat: predLat,
                        lon: predLon,
                        riskLevel,
                        distance: Math.round(distance)
                    };

                    if (riskLevel === 'High' || riskLevel === 'Severe') {
                        highRiskPoints.push(point);
                        totalRiskScore += riskLevel === 'Severe' ? 100 : 75;
                        if (riskLevel === 'Severe' || maxRisk !== 'Severe') {
                            maxRisk = riskLevel;
                        }
                    } else if (riskLevel === 'Moderate') {
                        moderateRiskPoints.push(point);
                        totalRiskScore += 50;
                        if (maxRisk === 'Low') maxRisk = 'Moderate';
                    }
                }
            });
        });

        const avgRiskScore = routeCoords.length > 0 ? totalRiskScore / routeCoords.length : 0;

        return {
            highRiskPoints,
            moderateRiskPoints,
            maxRisk,
            totalRiskScore,
            avgRiskScore: avgRiskScore.toFixed(2),
            safetyRating: avgRiskScore < 10 ? 'Safe' : avgRiskScore < 30 ? 'Moderate' : avgRiskScore < 60 ? 'Risky' : 'Dangerous'
        };
    };

    const getDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3; // Earth radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    };

    const getRiskColor = (rating) => {
        switch (rating) {
            case 'Safe': return 'text-green-600 bg-green-100 border-green-300';
            case 'Moderate': return 'text-yellow-600 bg-yellow-100 border-yellow-300';
            case 'Risky': return 'text-orange-600 bg-orange-100 border-orange-300';
            case 'Dangerous': return 'text-red-600 bg-red-100 border-red-300';
            default: return 'text-gray-600 bg-gray-100 border-gray-300';
        }
    };

    const clearAnalysis = () => {
        if (routingControlRef.current && mapInstanceRef.current) {
            mapInstanceRef.current.removeControl(routingControlRef.current);
            routingControlRef.current = null;
        }
        setRouteData(null);
        setRiskAnalysis(null);
        setOrigin('');
        setDestination('');
    };

    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            {/* Hero Header */}
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl shadow-2xl p-8 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                            🛣️ Route Risk Analysis
                        </h1>
                        <p className="text-blue-100 text-lg">
                            AI-powered landslide risk assessment for your travel route
                        </p>
                    </div>
                    <div className="hidden md:block text-6xl">
                        🗺️
                    </div>
                </div>
            </div>

            {/* Input Form */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <span>📍</span> Enter Your Route
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                            <span className="text-green-600">🟢</span> Starting Point
                        </label>
                        <input
                            type="text"
                            value={origin}
                            onChange={(e) => setOrigin(e.target.value)}
                            placeholder="e.g., Mumbai, Maharashtra"
                            className="w-full px-5 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-lg transition-all"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                            <span className="text-red-600">🔴</span> Destination
                        </label>
                        <input
                            type="text"
                            value={destination}
                            onChange={(e) => setDestination(e.target.value)}
                            placeholder="e.g., Pune, Maharashtra"
                            className="w-full px-5 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-lg transition-all"
                        />
                    </div>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={analyzeRoute}
                        disabled={analyzing}
                        className="flex-1 md:flex-none px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2"
                    >
                        {analyzing ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                Analyzing Route...
                            </>
                        ) : (
                            <>
                                🔍 Analyze Route Safety
                            </>
                        )}
                    </button>
                    {routeData && (
                        <button
                            onClick={clearAnalysis}
                            className="px-6 py-4 bg-gray-600 text-white rounded-xl hover:bg-gray-700 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                        >
                            ✕ Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Map */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <div
                    ref={mapRef}
                    className="w-full"
                    style={{ height: '500px' }}
                />

                {/* Routing Instructions Styling */}
                <style>{`
                    .leaflet-routing-container {
                        background: white !important;
                        border-radius: 8px !important;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1) !important;
                        padding: 12px !important;
                        max-width: 400px !important;
                    }
                    
                    .leaflet-routing-container h2,
                    .leaflet-routing-container h3 {
                        color: #1f2937 !important;
                        font-weight: 600 !important;
                        margin-bottom: 8px !important;
                        font-size: 16px !important;
                    }
                    
                    .leaflet-routing-alt {
                        background: #f9fafb !important;
                        border: 2px solid #e5e7eb !important;
                        border-radius: 6px !important;
                        padding: 12px !important;
                        margin-bottom: 10px !important;
                    }
                    
                    .leaflet-routing-alt:hover {
                        background: #f3f4f6 !important;
                        border-color: #3b82f6 !important;
                    }
                    
                    .leaflet-routing-alt-minimized {
                        color: #111827 !important;
                        font-weight: 600 !important;
                        font-size: 14px !important;
                    }
                    
                    .leaflet-routing-alt table {
                        color: #1f2937 !important;
                        width: 100% !important;
                    }
                    
                    .leaflet-routing-alt td {
                        padding: 6px 8px !important;
                        color: #374151 !important;
                        font-size: 13px !important;
                        border-bottom: 1px solid #e5e7eb !important;
                    }
                    
                    .leaflet-routing-alt td:first-child {
                        font-weight: 500 !important;
                        color: #1f2937 !important;
                    }
                    
                    .leaflet-routing-icon {
                        filter: brightness(0.2) !important;
                        margin-right: 8px !important;
                    }
                    
                    .leaflet-routing-geocoder {
                        display: none !important;
                    }
                    
                    .leaflet-routing-collapse-btn {
                        background: #3b82f6 !important;
                        color: white !important;
                        border-radius: 4px !important;
                        font-weight: 500 !important;
                        padding: 6px 12px !important;
                        border: none !important;
                    }
                    
                    .leaflet-routing-collapse-btn:hover {
                        background: #2563eb !important;
                    }
                    
                    .leaflet-routing-alt h3 {
                        color: #3b82f6 !important;
                        font-size: 15px !important;
                        font-weight: 600 !important;
                        margin-bottom: 10px !important;
                    }
                    
                    .leaflet-routing-alt-minimized span {
                        background: #3b82f6 !important;
                        color: white !important;
                        padding: 4px 10px !important;
                        border-radius: 4px !important;
                        font-size: 12px !important;
                        font-weight: 600 !important;
                        margin-left: 8px !important;
                    }
                    
                    /* Summary bar styling */
                    .leaflet-routing-alternatives-container {
                        background: white !important;
                    }
                    
                    /* Distance and time display */
                    .leaflet-routing-alt h3 span {
                        color: #059669 !important;
                        font-weight: 700 !important;
                    }
                `}</style>
            </div>

            {/* Results */}
            {routeData && riskAnalysis && (
                <div className="space-y-6">
                    {/* Overall Safety Card */}
                    <div className={`rounded-2xl shadow-2xl p-8 text-white ${riskAnalysis.safetyRating === 'Safe' ? 'bg-gradient-to-br from-green-500 to-green-700' :
                        riskAnalysis.safetyRating === 'Moderate' ? 'bg-gradient-to-br from-yellow-500 to-yellow-700' :
                            riskAnalysis.safetyRating === 'Risky' ? 'bg-gradient-to-br from-orange-500 to-orange-700' :
                                'bg-gradient-to-br from-red-500 to-red-700'
                        }`}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-3xl font-bold">Route Safety Assessment</h2>
                            <span className="text-6xl">
                                {riskAnalysis.safetyRating === 'Safe' ? '✅' :
                                    riskAnalysis.safetyRating === 'Moderate' ? '⚠️' :
                                        riskAnalysis.safetyRating === 'Risky' ? '🚨' : '⛔'}
                            </span>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6">
                            <p className="text-sm font-semibold text-white/80 mb-2">OVERALL RATING</p>
                            <p className="text-5xl font-bold mb-4">{riskAnalysis.safetyRating}</p>
                            <div className="grid grid-cols-3 gap-4 mt-6">
                                <div className="bg-white/10 rounded-lg p-4 text-center">
                                    <p className="text-xs text-white/70 mb-1">Max Risk</p>
                                    <p className="text-xl font-bold">{riskAnalysis.maxRisk}</p>
                                </div>
                                <div className="bg-white/10 rounded-lg p-4 text-center">
                                    <p className="text-xs text-white/70 mb-1">Avg Score</p>
                                    <p className="text-xl font-bold">{riskAnalysis.avgRiskScore}</p>
                                </div>
                                <div className="bg-white/10 rounded-lg p-4 text-center">
                                    <p className="text-xs text-white/70 mb-1">Distance</p>
                                    <p className="text-xl font-bold">{routeData.distance} km</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-shadow">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                    Route Info
                                </h3>
                                <span className="text-3xl">📍</span>
                            </div>
                            <div className="space-y-3">
                                <InfoRow label="Distance" value={`${routeData.distance} km`} />
                                <InfoRow label="Duration" value={`${routeData.duration} min`} />
                                <InfoRow label="Waypoints" value={routeData.coordinates.length.toString()} />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-shadow">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                    High Risk Zones
                                </h3>
                                <span className="text-3xl">🚨</span>
                            </div>
                            <div className="text-center py-6">
                                <div className="text-6xl font-bold text-red-600 mb-2">
                                    {riskAnalysis.highRiskPoints.length}
                                </div>
                                <p className="text-gray-600 dark:text-gray-400">Critical areas detected</p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-shadow">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                    Moderate Risk Zones
                                </h3>
                                <span className="text-3xl">⚠️</span>
                            </div>
                            <div className="text-center py-6">
                                <div className="text-6xl font-bold text-yellow-600 mb-2">
                                    {riskAnalysis.moderateRiskPoints.length}
                                </div>
                                <p className="text-gray-600 dark:text-gray-400">Caution areas detected</p>
                            </div>
                        </div>
                    </div>
                    {riskAnalysis.highRiskPoints.length === 0 && riskAnalysis.moderateRiskPoints.length === 0 && (
                        <div className="text-center text-green-600 font-medium mt-2">
                            ✓ No significant risks detected
                        </div>
                    )}
                </div>
            )}

            {/* Recommendations */}
            {riskAnalysis && (
                <div className={`rounded-lg shadow-lg p-6 ${riskAnalysis.safetyRating === 'Safe' ? 'bg-green-50 dark:bg-green-900' :
                    riskAnalysis.safetyRating === 'Moderate' ? 'bg-yellow-50 dark:bg-yellow-900' :
                        riskAnalysis.safetyRating === 'Risky' ? 'bg-orange-50 dark:bg-orange-900' :
                            'bg-red-50 dark:bg-red-900'
                    }`}>
                    <h3 className={`text-lg font-semibold mb-3 ${riskAnalysis.safetyRating === 'Safe' ? 'text-green-900 dark:text-green-100' :
                        riskAnalysis.safetyRating === 'Moderate' ? 'text-yellow-900 dark:text-yellow-100' :
                            riskAnalysis.safetyRating === 'Risky' ? 'text-orange-900 dark:text-orange-100' :
                                'text-red-900 dark:text-red-100'
                        }`}>
                        💡 Recommendations
                    </h3>
                    <ul className={`space-y-2 text-sm ${riskAnalysis.safetyRating === 'Safe' ? 'text-green-800 dark:text-green-200' :
                        riskAnalysis.safetyRating === 'Moderate' ? 'text-yellow-800 dark:text-yellow-200' :
                            riskAnalysis.safetyRating === 'Risky' ? 'text-orange-800 dark:text-orange-200' :
                                'text-red-800 dark:text-red-200'
                        }`}>
                        {riskAnalysis.safetyRating === 'Safe' && (
                            <>
                                <li>• Route appears safe with minimal landslide risk</li>
                                <li>• Still monitor weather conditions before travel</li>
                                <li>• Check local alerts for your travel dates</li>
                            </>
                        )}
                        {riskAnalysis.safetyRating === 'Moderate' && (
                            <>
                                <li>• Exercise caution, especially during monsoon season</li>
                                <li>• Avoid travel during heavy rainfall warnings</li>
                                <li>• Keep emergency contacts handy</li>
                                <li>• Consider alternative routes if weather deteriorates</li>
                            </>
                        )}
                        {riskAnalysis.safetyRating === 'Risky' && (
                            <>
                                <li>• ⚠️ High risk zones detected along route</li>
                                <li>• Strongly consider alternative routes</li>
                                <li>• If travel necessary, avoid monsoon season</li>
                                <li>• Keep emergency kit and communication devices</li>
                                <li>• Inform local authorities of travel plans</li>
                            </>
                        )}
                        {riskAnalysis.safetyRating === 'Dangerous' && (
                            <>
                                <li>• 🚨 SEVERE RISK: Route passes through multiple high-risk zones</li>
                                <li>• STRONGLY RECOMMENDED to find alternative route</li>
                                <li>• Do not travel during monsoon or after heavy rainfall</li>
                                <li>• Coordinate with local disaster management authorities</li>
                                <li>• Emergency evacuation plan essential if travel unavoidable</li>
                            </>
                        )}
                    </ul>
                </div>
            )}

            {/* Instructions */}
            {!routeData && (
                <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
                        📋 How to Use
                    </h3>
                    <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                        <li>1. Enter your starting location (origin)</li>
                        <li>2. Enter your destination</li>
                        <li>3. Click "Analyze Route" to calculate the safest path</li>
                        <li>4. Review the risk assessment and recommendations</li>
                        <li>5. Red markers indicate high-risk zones along your route</li>
                    </ol>
                </div>
            )}
        </div>
    );
};

const InfoRow = ({ label, value }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
        <span className="text-gray-600 dark:text-gray-400 font-medium">{label}</span>
        <span className="font-bold text-gray-900 dark:text-white">{value}</span>
    </div>
);

export default RouteAnalysis;
