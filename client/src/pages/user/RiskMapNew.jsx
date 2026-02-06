import { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine';
import {
    getActivePredictions,
    getHistoricalIncidents,
    getCurrentWeather,
    getRainfallAlert
} from '../../services/mapService';

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const RiskMap = () => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);
    const routingControlRef = useRef(null);
    const { user } = useSelector((state) => state.auth);

    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapStyle, setMapStyle] = useState('outdoors');
    const [predictions, setPredictions] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [weather, setWeather] = useState(null);
    const [rainfallAlert, setRainfallAlert] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showIncidents, setShowIncidents] = useState(true);
    const [showPredictions, setShowPredictions] = useState(true);
    const [showWeather, setShowWeather] = useState(true);
    const [routeStart, setRouteStart] = useState(null);
    const [routeEnd, setRouteEnd] = useState(null);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

    // Fetch data
    useEffect(() => {
        const fetchMapData = async () => {
            if (!user?.location?.coordinates ||
                !Array.isArray(user.location.coordinates) ||
                user.location.coordinates.length !== 2 ||
                !user.location.coordinates[0] ||
                !user.location.coordinates[1]) {
                console.log('Risk Map: No valid user location set, skipping data fetch', user?.location);
                return;
            }

            const [lon, lat] = user.location.coordinates;

            // Extra validation for valid coordinates
            if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                console.error('Risk Map: Invalid coordinates:', { lat, lon });
                return;
            }

            console.log('Risk Map: Fetching data for location:', { lat, lon });

            try {
                setLoading(true);

                // Fetch all data in parallel
                const [predictionsData, incidentsData, weatherData, alertData] = await Promise.all([
                    getActivePredictions(lat, lon, 100).catch((err) => {
                        console.error('Failed to fetch predictions:', err);
                        return { predictions: [] };
                    }),
                    getHistoricalIncidents(lat, lon, 150).catch((err) => {
                        console.error('Failed to fetch incidents:', err);
                        return { incidents: [] };
                    }),
                    getCurrentWeather(lat, lon).catch((err) => {
                        console.error('Failed to fetch weather:', err);
                        return null;
                    }),
                    getRainfallAlert(lat, lon).catch((err) => {
                        console.error('Failed to fetch rainfall alert:', err);
                        return null;
                    })
                ]);

                console.log('Risk Map: Fetched data:', {
                    predictions: predictionsData.predictions?.length || 0,
                    incidents: incidentsData.incidents?.length || 0,
                    hasWeather: !!weatherData,
                    hasAlert: !!alertData
                });

                setPredictions(predictionsData.predictions || []);
                setIncidents(incidentsData.incidents || []);
                setWeather(weatherData?.weather);
                setRainfallAlert(alertData);

            } catch (err) {
                console.error('Failed to fetch map data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchMapData();
    }, [user?.location?.coordinates]);

    // Initialize map
    useEffect(() => {
        if (!mapInstanceRef.current && mapRef.current) {
            const defaultLat = user?.location?.coordinates?.[1] || 12.9716;
            const defaultLon = user?.location?.coordinates?.[0] || 77.5946;

            const map = L.map(mapRef.current).setView([defaultLat, defaultLon], 8);
            const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

            if (mapboxToken && mapboxToken !== 'pk.your_mapbox_token_here_optional') {
                const styles = {
                    outdoors: 'mapbox/outdoors-v12',
                    satellite: 'mapbox/satellite-streets-v12',
                    streets: 'mapbox/streets-v12'
                };

                L.tileLayer(`https://api.mapbox.com/styles/v1/${styles[mapStyle]}/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`, {
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

            // User location marker
            if (user?.location?.coordinates) {
                L.marker([defaultLat, defaultLon], {
                    icon: L.divIcon({
                        className: 'custom-user-marker',
                        html: '<div style="background: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                        iconSize: [20, 20]
                    })
                })
                    .addTo(map)
                    .bindPopup(`
                    <div class="p-2">
                        <strong>📍 Your Location</strong><br/>
                        ${user.location.city || ''}, ${user.location.state || ''}
                    </div>
                `);
            }

            mapInstanceRef.current = map;
            setMapLoaded(true);
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [user, mapStyle]);

    // Render predictions
    useEffect(() => {
        if (!mapInstanceRef.current || !mapLoaded) return;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        // Add prediction markers
        if (showPredictions) {
            predictions.forEach(pred => {
                if (!pred.location?.coordinates) return;

                const [lon, lat] = pred.location.coordinates;
                const color = getRiskColor(pred.prediction.riskLevel);
                const radiusMap = { 'Low': 8, 'Moderate': 12, 'High': 16, 'Severe': 20 };

                const marker = L.circleMarker([lat, lon], {
                    radius: radiusMap[pred.prediction.riskLevel] || 10,
                    fillColor: color,
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.7
                }).addTo(mapInstanceRef.current);

                const influenceRadius = L.circle([lat, lon], {
                    radius: pred.prediction.riskLevel === 'Severe' ? 5000 :
                        pred.prediction.riskLevel === 'High' ? 3000 :
                            pred.prediction.riskLevel === 'Moderate' ? 2000 : 1000,
                    fillColor: color,
                    color: color,
                    weight: 1,
                    opacity: 0.3,
                    fillOpacity: 0.1
                }).addTo(mapInstanceRef.current);

                marker.bindPopup(`
                <div class="p-3 min-w-[220px]">
                    <h4 class="font-bold text-lg mb-2">🌋 Risk Assessment</h4>
                    <div class="space-y-1 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Risk Level:</span>
                            <span style="color: ${color}; font-weight: bold;">${pred.prediction.riskLevel}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Probability:</span>
                            <span class="font-semibold">${(pred.prediction.probability * 100).toFixed(0)}%</span>
                        </div>
                        ${pred.features?.slope ? `
                        <div class="flex justify-between">
                            <span class="text-gray-600">Slope:</span>
                            <span class="font-semibold">${pred.features.slope}°</span>
                        </div>` : ''}
                        ${pred.weather?.currentRainfall ? `
                        <div class="flex justify-between">
                            <span class="text-gray-600">Rainfall:</span>
                            <span class="font-semibold">${pred.weather.currentRainfall}mm</span>
                        </div>` : ''}
                        <div class="text-xs text-gray-500 mt-2">
                            Updated: ${new Date(pred.createdAt).toLocaleString()}
                        </div>
                    </div>
                </div>
            `);

                marker.on('mouseover', function () {
                    this.setStyle({ fillOpacity: 0.9, weight: 3 });
                });
                marker.on('mouseout', function () {
                    this.setStyle({ fillOpacity: 0.7, weight: 2 });
                });

                markersRef.current.push(marker, influenceRadius);
            });
        }

        // Add historical incident markers
        if (showIncidents) {
            incidents.forEach(incident => {
                if (!incident.location?.coordinates) return;

                const [lon, lat] = incident.location.coordinates;
                const severityColor = {
                    'Minor': '#94a3b8',
                    'Moderate': '#fb923c',
                    'Major': '#ef4444',
                    'Catastrophic': '#7f1d1d'
                };

                const marker = L.circleMarker([lat, lon], {
                    radius: 6,
                    fillColor: severityColor[incident.severity] || '#6b7280',
                    color: '#000',
                    weight: 1,
                    opacity: 0.8,
                    fillOpacity: 0.6,
                    className: 'historical-incident'
                }).addTo(mapInstanceRef.current);

                marker.bindPopup(`
                    <div class="p-3 min-w-[220px]">
                        <h4 class="font-bold text-lg mb-2">📜 Past Incident</h4>
                        <div class="space-y-1 text-sm">
                            <div class="flex justify-between">
                                <span class="text-gray-600">Date:</span>
                                <span class="font-semibold">${new Date(incident.incidentDate).toLocaleDateString()}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-600">Severity:</span>
                                <span class="font-bold" style="color: ${severityColor[incident.severity]}">${incident.severity}</span>
                            </div>
                            ${incident.details?.casualties?.deaths ? `
                            <div class="flex justify-between">
                                <span class="text-gray-600">Casualties:</span>
                                <span class="font-semibold">${incident.details.casualties.deaths} deaths</span>
                            </div>` : ''}
                            ${incident.description ? `
                            <div class="mt-2 text-xs text-gray-700">
                                ${incident.description.substring(0, 100)}...
                            </div>` : ''}
                        </div>
                    </div>
                `);

                markersRef.current.push(marker);
            });
        }

    }, [predictions, incidents, showIncidents, showPredictions, mapLoaded]);

    const getRiskColor = (risk) => {
        const colors = {
            'Low': '#22c55e',
            'Moderate': '#eab308',
            'High': '#f97316',
            'Severe': '#ef4444',
        };
        return colors[risk] || '#6b7280';
    };

    // Route planning with risk avoidance
    const calculateSafeRoute = () => {
        if (!mapInstanceRef.current || !routeStart || !routeEnd) return;

        // Remove existing route
        if (routingControlRef.current) {
            mapInstanceRef.current.removeControl(routingControlRef.current);
        }

        const routing = L.Routing.control({
            waypoints: [
                L.latLng(routeStart.lat, routeStart.lng),
                L.latLng(routeEnd.lat, routeEnd.lng)
            ],
            router: L.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1'
            }),
            lineOptions: {
                styles: [{ color: '#3b82f6', weight: 6, opacity: 0.7 }]
            },
            showAlternatives: true,
            altLineOptions: {
                styles: [{ color: '#94a3b8', weight: 4, opacity: 0.5 }]
            },
            createMarker: function (i, waypoint, n) {
                const marker = L.marker(waypoint.latLng, {
                    draggable: true,
                    icon: L.divIcon({
                        className: 'route-marker',
                        html: `<div style="background: ${i === 0 ? '#22c55e' : '#ef4444'}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">${i === 0 ? 'A' : 'B'}</div>`,
                        iconSize: [24, 24]
                    })
                });

                marker.on('dragend', function (e) {
                    const pos = e.target.getLatLng();
                    if (i === 0) {
                        setRouteStart(pos);
                    } else {
                        setRouteEnd(pos);
                    }
                });

                return marker;
            }
        }).addTo(mapInstanceRef.current);

        // Analyze route for risk zones
        routing.on('routesfound', function (e) {
            const routes = e.routes;
            const summary = routes[0].summary;

            // Check if route passes through high-risk zones
            let riskWarning = false;
            const routeCoords = routes[0].coordinates;

            predictions.forEach(pred => {
                if (pred.prediction.riskLevel === 'High' || pred.prediction.riskLevel === 'Severe') {
                    const [predLon, predLat] = pred.location.coordinates;

                    routeCoords.forEach(coord => {
                        const distance = mapInstanceRef.current.distance(
                            [predLat, predLon],
                            [coord.lat, coord.lng]
                        );

                        if (distance < 2000) { // Within 2km of high-risk zone
                            riskWarning = true;
                        }
                    });
                }
            });

            if (riskWarning) {
                L.popup()
                    .setLatLng(routeCoords[Math.floor(routeCoords.length / 2)])
                    .setContent(`
                        <div class="p-3 bg-yellow-50 border-l-4 border-yellow-500">
                            <h4 class="font-bold text-yellow-800">⚠️ Route Warning</h4>
                            <p class="text-sm text-yellow-700 mt-1">
                                This route passes near high-risk landslide zones. 
                                Consider alternative routes or exercise caution.
                            </p>
                        </div>
                    `)
                    .openOn(mapInstanceRef.current);
            }
        });

        routingControlRef.current = routing;
    };

    const enableRouteMode = () => {
        setShowRouting(true);

        if (!mapInstanceRef.current) return;

        // Set click handler for selecting route points
        const clickHandler = (e) => {
            if (!routeStart) {
                setRouteStart(e.latlng);
                L.popup()
                    .setLatLng(e.latlng)
                    .setContent('Start point selected. Click destination.')
                    .openOn(mapInstanceRef.current);
            } else if (!routeEnd) {
                setRouteEnd(e.latlng);
            }
        };

        mapInstanceRef.current.on('click', clickHandler);
    };

    const clearRoute = () => {
        if (routingControlRef.current && mapInstanceRef.current) {
            mapInstanceRef.current.removeControl(routingControlRef.current);
            routingControlRef.current = null;
        }
        setRouteStart(null);
        setRouteEnd(null);
        setShowRouting(false);

        if (mapInstanceRef.current) {
            mapInstanceRef.current.off('click');
        }
    };

    // Calculate route when both points are set
    useEffect(() => {
        if (routeStart && routeEnd) {
            calculateSafeRoute();
        }
    }, [routeStart, routeEnd]);

    return (
        <div className="h-screen flex flex-col p-6 space-y-6">
            {/* Hero Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl shadow-2xl p-6 text-white flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                            🗺️ Live Risk Map
                        </h1>
                        <p className="text-purple-100">
                            Real-time landslide risk zones with historical data
                        </p>
                    </div>
                    {loading && (
                        <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                            <span className="text-sm font-semibold">Loading...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Controls & Stats Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 flex-shrink-0">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    {/* Layer Controls */}
                    <div className="flex gap-2 flex-wrap">
                        <ToggleButton
                            active={showPredictions}
                            onClick={() => setShowPredictions(!showPredictions)}
                            icon="🌋"
                            label="Risk Zones"
                            color="blue"
                        />
                        <ToggleButton
                            active={showIncidents}
                            onClick={() => setShowIncidents(!showIncidents)}
                            icon="📜"
                            label="History"
                            color="purple"
                        />
                        <ToggleButton
                            active={showWeather}
                            onClick={() => setShowWeather(!showWeather)}
                            icon="🌤️"
                            label="Weather"
                            color="green"
                        />
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4">
                        <StatBadge
                            icon="🔴"
                            value={predictions.filter(p => p.prediction.riskLevel === 'Severe' || p.prediction.riskLevel === 'High').length}
                            label="High Risk"
                            color="red"
                        />
                        <StatBadge
                            icon="📍"
                            value={predictions.length}
                            label="Predictions"
                            color="blue"
                        />
                        <StatBadge
                            icon="📜"
                            value={incidents.length}
                            label="Incidents"
                            color="gray"
                        />
                    </div>

                    {/* Map Style Selector */}
                    <div className="flex gap-2">
                        <MapStyleButton
                            active={mapStyle === 'outdoors'}
                            onClick={() => setMapStyle('outdoors')}
                            icon="🏔️"
                            label="Terrain"
                        />
                        <MapStyleButton
                            active={mapStyle === 'satellite'}
                            onClick={() => setMapStyle('satellite')}
                            icon="🛰️"
                            label="Satellite"
                        />
                        <MapStyleButton
                            active={mapStyle === 'streets'}
                            onClick={() => setMapStyle('streets')}
                            icon="🗺️"
                            label="Streets"
                        />
                    </div>
                </div>
            </div>

            {/* Map Container */}
            <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden relative">
                <div ref={mapRef} className="w-full h-full" />

                {/* Map Legend Overlay */}
                <div className="absolute bottom-6 left-6 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-2xl p-4 z-[1000] max-w-xs">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <span>🎨</span> Legend
                    </h3>

                    {showPredictions && (
                        <div className="mb-4">
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">RISK LEVELS</p>
                            <div className="space-y-2">
                                <LegendItem color="#ef4444" label="Severe Risk" size="large" />
                                <LegendItem color="#f97316" label="High Risk" size="medium" />
                                <LegendItem color="#eab308" label="Moderate Risk" size="medium" />
                                <LegendItem color="#3b82f6" label="Low Risk" size="small" />
                                <LegendItem color="#22c55e" label="Very Low Risk" size="small" />
                            </div>
                        </div>
                    )}

                    {showIncidents && (
                        <div>
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">HISTORICAL INCIDENTS</p>
                            <div className="space-y-2">
                                <LegendItem color="#7f1d1d" label="Catastrophic" size="small" marker="square" />
                                <LegendItem color="#ef4444" label="Major" size="small" marker="square" />
                                <LegendItem color="#fb923c" label="Moderate" size="small" marker="square" />
                                <LegendItem color="#94a3b8" label="Minor" size="small" marker="square" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Weather Info Overlay */}
                {showWeather && weather && (
                    <div className="absolute top-6 right-6 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-2xl p-4 z-[1000] min-w-[240px]">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <span>🌤️</span> Weather
                        </h3>
                        <div className="space-y-2 text-sm">
                            <WeatherRow icon="🌡️" label="Temperature" value={`${weather.temp}°C`} />
                            <WeatherRow icon="💧" label="Humidity" value={`${weather.humidity}%`} />
                            {weather.rainfall && <WeatherRow icon="🌧️" label="Rainfall" value={`${weather.rainfall}mm`} />}
                            {weather.windSpeed && <WeatherRow icon="💨" label="Wind" value={`${weather.windSpeed}km/h`} />}
                        </div>
                        {rainfallAlert && (
                            <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg border border-yellow-300 dark:border-yellow-700">
                                <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-200">
                                    ⚠️ {rainfallAlert.message}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper Components
const ToggleButton = ({ active, onClick, icon, label, color }) => {
    const colors = {
        blue: active ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
        purple: active ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
        green: active ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    };

    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:shadow-md flex items-center gap-2 ${colors[color]}`}
        >
            <span>{icon}</span> {label}
        </button>
    );
};

const StatBadge = ({ icon, value, label, color }) => {
    const colors = {
        red: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700',
        blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700',
        gray: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600',
    };

    return (
        <div className={`px-4 py-2 rounded-lg border-2 ${colors[color]} flex items-center gap-2`}>
            <span className="text-xl">{icon}</span>
            <div>
                <p className="text-2xl font-bold leading-none">{value}</p>
                <p className="text-xs font-medium">{label}</p>
            </div>
        </div>
    );
};

const MapStyleButton = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${active
            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
    >
        {icon} {label}
    </button>
);

const LegendItem = ({ color, label, size, marker = 'circle' }) => {
    const sizes = {
        large: 'w-5 h-5',
        medium: 'w-4 h-4',
        small: 'w-3 h-3',
    };

    return (
        <div className="flex items-center gap-2">
            <div
                className={`${sizes[size]} ${marker === 'square' ? 'rounded-sm' : 'rounded-full'} border-2 border-white shadow-sm`}
                style={{ backgroundColor: color }}
            />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
        </div>
    );
};

const WeatherRow = ({ icon, label, value }) => (
    <div className="flex items-center justify-between py-1">
        <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2 text-sm">
            <span>{icon}</span> {label}
        </span>
        <span className="font-bold text-gray-900 dark:text-white text-sm">{value}</span>
    </div>
);

export default RiskMap;
