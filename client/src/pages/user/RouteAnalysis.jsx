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
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Route Risk Analysis
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Analyze landslide risks along your travel route
                </p>
            </div>

            {/* Input Form */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Origin (Starting Point)
                        </label>
                        <input
                            type="text"
                            value={origin}
                            onChange={(e) => setOrigin(e.target.value)}
                            placeholder="e.g., Mumbai, Maharashtra"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Destination (End Point)
                        </label>
                        <input
                            type="text"
                            value={destination}
                            onChange={(e) => setDestination(e.target.value)}
                            placeholder="e.g., Pune, Maharashtra"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={analyzeRoute}
                        disabled={analyzing}
                        className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                    >
                        {analyzing ? '🔍 Analyzing...' : '🗺️ Analyze Route'}
                    </button>
                    {routeData && (
                        <button
                            onClick={clearAnalysis}
                            className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium"
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Route Info */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            📍 Route Information
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Distance:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{routeData.distance} km</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{routeData.duration} min</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Waypoints:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{routeData.coordinates.length}</span>
                            </div>
                        </div>
                    </div>

                    {/* Risk Summary */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            ⚠️ Risk Summary
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <span className="text-gray-600 dark:text-gray-400 text-sm">Safety Rating:</span>
                                <div className={`mt-1 px-3 py-2 rounded-lg border-2 font-bold text-center ${getRiskColor(riskAnalysis.safetyRating)}`}>
                                    {riskAnalysis.safetyRating}
                                </div>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Max Risk:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{riskAnalysis.maxRisk}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Avg Risk Score:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{riskAnalysis.avgRiskScore}</span>
                            </div>
                        </div>
                    </div>

                    {/* Risk Zones */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            🚨 Risk Zones Detected
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-red-600 font-medium">High Risk:</span>
                                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-bold">
                                    {riskAnalysis.highRiskPoints.length}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-yellow-600 font-medium">Moderate Risk:</span>
                                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full font-bold">
                                    {riskAnalysis.moderateRiskPoints.length}
                                </span>
                            </div>
                            {riskAnalysis.highRiskPoints.length === 0 && riskAnalysis.moderateRiskPoints.length === 0 && (
                                <div className="text-center text-green-600 font-medium mt-2">
                                    ✓ No significant risks detected
                                </div>
                            )}
                        </div>
                    </div>
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

export default RouteAnalysis;
