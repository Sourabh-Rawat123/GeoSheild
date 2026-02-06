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
    getRainfallAlert,
    seedHistoricalData
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
    const [showWeather, setShowWeather] = useState(true);
    const [showRouting, setShowRouting] = useState(false);
    const [routeStart, setRouteStart] = useState(null);
    const [routeEnd, setRouteEnd] = useState(null);

    // Fetch data
    useEffect(() => {
        const fetchMapData = async () => {
            if (!user?.location?.coordinates) {
                console.log('No user location, fetching all historical incidents');
                // Fetch all incidents if no user location
                try {
                    const incidentsData = await getHistoricalIncidents().catch(err => {
                        console.error('Error fetching incidents:', err);
                        return { incidents: [] };
                    });

                    // If no incidents, try to seed the database
                    if (!incidentsData.incidents || incidentsData.incidents.length === 0) {
                        console.log('No historical incidents found, seeding database...');
                        const seedResult = await seedHistoricalData();
                        if (seedResult?.success) {
                            console.log('Database seeded successfully, re-fetching incidents...');
                            const newIncidentsData = await getHistoricalIncidents().catch(err => {
                                console.error('Error re-fetching incidents:', err);
                                return { incidents: [] };
                            });
                            setIncidents(newIncidentsData.incidents || []);
                        }
                    } else {
                        setIncidents(incidentsData.incidents || []);
                    }

                    console.log('Fetched incidents:', incidentsData.incidents?.length || 0);
                } catch (err) {
                    console.error('Failed to fetch incidents:', err);
                }
                setLoading(false);
                return;
            }

            const [lon, lat] = user.location.coordinates;
            console.log('Fetching data for location:', lat, lon);

            try {
                setLoading(true);

                // Fetch all data in parallel
                const [predictionsData, incidentsData, weatherData, alertData] = await Promise.all([
                    getActivePredictions(lat, lon, 100).catch(err => {
                        console.error('Predictions error:', err);
                        return { predictions: [] };
                    }),
                    getHistoricalIncidents(lat, lon, 150).catch(err => {
                        console.error('Incidents error:', err);
                        return { incidents: [] };
                    }),
                    getCurrentWeather(lat, lon).catch(err => {
                        console.error('Weather error:', err);
                        return null;
                    }),
                    getRainfallAlert(lat, lon).catch(err => {
                        console.error('Alert error:', err);
                        return null;
                    })
                ]);

                console.log('Fetched data:', {
                    predictions: predictionsData.predictions?.length || 0,
                    incidents: incidentsData.incidents?.length || 0,
                    weather: !!weatherData,
                    alert: !!alertData
                });

                console.log('Incidents data detail:', incidentsData.incidents);

                // If no incidents found, seed the database
                if (!incidentsData.incidents || incidentsData.incidents.length === 0) {
                    console.log('No historical incidents found nearby, seeding database...');
                    const seedResult = await seedHistoricalData();
                    if (seedResult?.success) {
                        console.log('Database seeded, re-fetching incidents...');
                        const newIncidentsData = await getHistoricalIncidents(lat, lon, 150).catch(err => {
                            console.error('Error re-fetching incidents:', err);
                            return { incidents: [] };
                        });
                        setIncidents(newIncidentsData.incidents || []);
                    } else {
                        setIncidents([]);
                    }
                } else {
                    setIncidents(incidentsData.incidents || []);
                }

                setPredictions(predictionsData.predictions || []);
                setWeather(weatherData?.weather);
                setRainfallAlert(alertData);

            } catch (err) {
                console.error('Failed to fetch map data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchMapData();
    }, [user]);

    // Initialize map
    useEffect(() => {
        if (!mapInstanceRef.current && mapRef.current) {
            const defaultLat = user?.location?.coordinates?.[1] || 30.3165; // Dehradun
            const defaultLon = user?.location?.coordinates?.[0] || 78.0322; // Dehradun
            const map = L.map(mapRef.current);
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
                    maxZoom: 25,
                }).addTo(map);
            } else {
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 25,
                }).addTo(map);
            }

            // Try to get user's real geolocation
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const { latitude, longitude } = pos.coords;
                        map.setView([latitude, longitude], 8, { animate: true });
                        // Add marker for real geolocation
                        L.marker([latitude, longitude], {
                            icon: L.divIcon({
                                className: 'custom-user-marker',
                                html: '<div style="background: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                                iconSize: [20, 20]
                            })
                        })
                            .addTo(map)
                            .bindPopup('<div class="p-2"><strong>📍 Your Real-Time Location</strong></div>')
                            .openPopup();
                    },
                    (err) => {
                        // If denied or error, fallback to profile/default
                        map.setView([defaultLat, defaultLon], 8, { animate: true });
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
                                        <strong>📍 Your Profile Location</strong><br/>
                                        ${user.location.city || ''}, ${user.location.state || ''}
                                    </div>
                                `);
                        }
                    },
                    { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
                );
            } else {
                // Geolocation not supported, fallback
                map.setView([defaultLat, defaultLon], 8, { animate: true });
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
                                <strong>📍 Your Profile Location</strong><br/>
                                ${user.location.city || ''}, ${user.location.state || ''}
                            </div>
                        `);
                }
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
        if (!mapInstanceRef.current || !mapLoaded) {
            console.log('Map not ready:', { mapInstance: !!mapInstanceRef.current, mapLoaded });
            return;
        }

        console.log('Map is ready, rendering markers...');

        // Clear existing markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        // Add prediction markers
        predictions.forEach(pred => {
            if (!pred.location?.coordinates) return;

            const [lon, lat] = pred.location.coordinates;
            const color = getRiskColor(pred.prediction.riskLevel);
            const sizeMap = { 'Low': 16, 'Moderate': 20, 'High': 24, 'Severe': 28 };
            const size = sizeMap[pred.prediction.riskLevel] || 18;

            // Use div icon for predictions with proper visibility
            const marker = L.marker([lat, lon], {
                icon: L.divIcon({
                    className: 'custom-prediction-marker',
                    html: `<div style="
                        width: ${size}px; 
                        height: ${size}px; 
                        background-color: ${color}; 
                        border: 3px solid #fff; 
                        border-radius: 50%; 
                        box-shadow: 0 0 15px rgba(0,0,0,0.6);
                        animation: pulse 2s infinite;
                    "></div>
                    <style>
                        @keyframes pulse {
                            0%, 100% { transform: scale(1); }
                            50% { transform: scale(1.1); }
                        }
                    </style>`,
                    iconSize: [size, size],
                    iconAnchor: [size / 2, size / 2]
                }),
                zIndexOffset: 2000
            }).addTo(mapInstanceRef.current);

            console.log('Prediction marker created at:', [lat, lon], 'with color:', color);

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

            markersRef.current.push(marker, influenceRadius);
        });

        // Add historical incident markers
        if (showIncidents) {
            console.log('Rendering incidents:', incidents.length, 'incidents');
            incidents.forEach(incident => {
                if (!incident.location?.coordinates) {
                    console.warn('Incident missing coordinates:', incident);
                    return;
                }

                const [lon, lat] = incident.location.coordinates;
                console.log(`Rendering incident at [${lat}, ${lon}]:`, incident.location.city);

                const severityColor = {
                    'Minor': '#94a3b8',
                    'Moderate': '#fb923c',
                    'Major': '#ef4444',
                    'Catastrophic': '#7f1d1d'
                };

                // Use custom div icon for better visibility
                const marker = L.marker([lat, lon], {
                    icon: L.divIcon({
                        className: 'custom-incident-marker',
                        html: `<div style="
                            width: 20px; 
                            height: 20px; 
                            background-color: ${severityColor[incident.severity] || '#6b7280'}; 
                            border: 3px solid #fff; 
                            border-radius: 50%; 
                            box-shadow: 0 0 10px rgba(0,0,0,0.5);
                        "></div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    }),
                    zIndexOffset: 1000
                }).addTo(mapInstanceRef.current);

                console.log('Marker added to map:', marker.getLatLng());

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

    }, [predictions, incidents, showIncidents, mapLoaded, mapStyle]);

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

        // Check if Leaflet Routing Machine is loaded
        if (!L.Routing) {
            console.error('Leaflet Routing Machine not loaded');
            alert('Route planning feature is not available. Please refresh the page.');
            return;
        }

        // Remove existing route
        if (routingControlRef.current) {
            mapInstanceRef.current.removeControl(routingControlRef.current);
        }

        try {
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
        } catch (error) {
            console.error('Error creating route:', error);
            alert('Failed to calculate route. Please try again.');
            clearRoute();
        }
    };

    const enableRouteMode = () => {
        setShowRouting(true);
        setRouteStart(null);
        setRouteEnd(null);
    };

    // Handle map clicks for route planning
    useEffect(() => {
        if (!showRouting || !mapInstanceRef.current) return;

        const clickHandler = (e) => {
            if (!routeStart) {
                setRouteStart(e.latlng);
                L.popup()
                    .setLatLng(e.latlng)
                    .setContent('<strong>Start point selected</strong><br/>Click destination.')
                    .openOn(mapInstanceRef.current);
            } else if (!routeEnd) {
                setRouteEnd(e.latlng);
            }
        };

        mapInstanceRef.current.on('click', clickHandler);

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.off('click', clickHandler);
            }
        };
    }, [showRouting, routeStart, routeEnd]);

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
        <div className="h-full space-y-4">
            {/* Header with controls */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Risk Map {loading && <span className="text-sm text-gray-500">Loading...</span>}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Real-time landslide risk assessment with weather data
                    </p>
                </div>

                {/* Map Style Selector */}
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setMapStyle('outdoors')}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${mapStyle === 'outdoors' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                    >
                        🏔️ Terrain
                    </button>
                    <button
                        onClick={() => setMapStyle('satellite')}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${mapStyle === 'satellite' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                    >
                        🛰️ Satellite
                    </button>
                    <button
                        onClick={() => setMapStyle('streets')}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${mapStyle === 'streets' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                    >
                        🗺️ Streets
                    </button>
                    <button
                        onClick={() => setShowIncidents(!showIncidents)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showIncidents ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                    >
                        📜 {showIncidents ? 'Hide' : 'Show'} History
                    </button>
                    {!showRouting ? (
                        <button
                            onClick={enableRouteMode}
                            className="px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-green-500 text-white hover:bg-green-600"
                        >
                            🗺️ Plan Safe Route
                        </button>
                    ) : (
                        <button
                            onClick={clearRoute}
                            className="px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-red-500 text-white hover:bg-red-600"
                        >
                            ✕ Clear Route
                        </button>
                    )}
                </div>
            </div>

            {/* Weather Alert Banner */}
            {rainfallAlert?.hasAlert && (
                <div className="bg-yellow-50 dark:bg-yellow-900 border-l-4 border-yellow-400 p-4 rounded">
                    <div className="flex items-start">
                        <span className="text-2xl mr-3">⚠️</span>
                        <div>
                            <h3 className="font-bold text-yellow-800 dark:text-yellow-200">Weather Alert</h3>
                            {rainfallAlert.alerts.map((alert, idx) => (
                                <p key={idx} className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                    {alert.message}
                                </p>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Stats & Legend */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Legend */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        Landslide Risk Levels
                    </h3>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-green-500"></div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Low (&lt;25% probability)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Moderate (25-50%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">High (50-75%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-red-500"></div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Severe (&gt;75%)</span>
                        </div>
                        {showIncidents && (
                            <div className="flex items-center gap-2 mt-3 pt-2 border-t">
                                <div className="w-4 h-4 rounded-full bg-gray-600 border border-black"></div>
                                <span className="text-sm text-gray-600 dark:text-gray-400">Historical Incidents</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Weather Info */}
                {weather && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                            Current Weather Conditions
                        </h3>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <span className="text-gray-600 dark:text-gray-400">Temperature:</span>
                                <p className="font-semibold text-gray-900 dark:text-white">{weather.temperature?.toFixed(1)}°C</p>
                            </div>
                            <div>
                                <span className="text-gray-600 dark:text-gray-400">Humidity:</span>
                                <p className="font-semibold text-gray-900 dark:text-white">{weather.humidity?.toFixed(1)}%</p>
                            </div>
                            <div>
                                <span className="text-gray-600 dark:text-gray-400">Rainfall:</span>
                                <p className="font-semibold text-gray-900 dark:text-white">{weather.rainfall?.toFixed(1) || 0}mm</p>
                            </div>
                            <div>
                                <span className="text-gray-600 dark:text-gray-400">Wind:</span>
                                <p className="font-semibold text-gray-900 dark:text-white">{weather.windSpeed?.toFixed(1)} m/s</p>
                            </div>
                        </div>
                        {rainfallAlert?.forecast24h > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-sm">
                                <span className="text-gray-600 dark:text-gray-400">24h Forecast:</span>
                                <p className="font-semibold text-blue-600 dark:text-blue-400">{rainfallAlert.forecast24h.toFixed(1)}mm rainfall expected</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Map Container */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <div
                    ref={mapRef}
                    className="w-full h-[calc(100vh-400px)]"
                    style={{ minHeight: '500px' }}
                />

                {/* Custom Routing Panel Styles */}
                <style>{`
                    .leaflet-routing-container {
                        background: white !important;
                        border-radius: 8px !important;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1) !important;
                        padding: 12px !important;
                        max-width: 350px !important;
                    }
                    
                    .leaflet-routing-container h2,
                    .leaflet-routing-container h3 {
                        color: #1f2937 !important;
                        font-weight: 600 !important;
                        margin-bottom: 8px !important;
                    }
                    
                    .leaflet-routing-alt {
                        background: #f9fafb !important;
                        border: 1px solid #e5e7eb !important;
                        border-radius: 6px !important;
                        padding: 10px !important;
                        margin-bottom: 8px !important;
                    }
                    
                    .leaflet-routing-alt:hover {
                        background: #f3f4f6 !important;
                        border-color: #3b82f6 !important;
                    }
                    
                    .leaflet-routing-alt-minimized {
                        color: #374151 !important;
                        font-weight: 500 !important;
                    }
                    
                    .leaflet-routing-alt table {
                        color: #1f2937 !important;
                    }
                    
                    .leaflet-routing-alt td {
                        padding: 4px 8px !important;
                        color: #374151 !important;
                    }
                    
                    .leaflet-routing-icon {
                        filter: brightness(0.3) !important;
                    }
                    
                    .leaflet-routing-geocoder {
                        display: none !important;
                    }
                    
                    .leaflet-routing-collapse-btn {
                        background: #3b82f6 !important;
                        color: white !important;
                        border-radius: 4px !important;
                        font-weight: 500 !important;
                    }
                    
                    .leaflet-routing-collapse-btn:hover {
                        background: #2563eb !important;
                    }
                    
                    /* Route summary styling */
                    .leaflet-routing-alt h3 {
                        color: #3b82f6 !important;
                        font-size: 14px !important;
                        font-weight: 600 !important;
                    }
                    
                    .leaflet-routing-alt-minimized span {
                        background: #3b82f6 !important;
                        color: white !important;
                        padding: 2px 8px !important;
                        border-radius: 4px !important;
                        font-size: 12px !important;
                        font-weight: 500 !important;
                    }
                `}</style>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
                    <h4 className="text-sm text-blue-600 dark:text-blue-300 mb-1">Active Predictions</h4>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{predictions.length}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900 p-4 rounded-lg">
                    <h4 className="text-sm text-purple-600 dark:text-purple-300 mb-1">Historical Incidents</h4>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{incidents.length}</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900 p-4 rounded-lg">
                    <h4 className="text-sm text-orange-600 dark:text-orange-300 mb-1">High Risk Zones</h4>
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                        {predictions.filter(p => p.prediction.riskLevel === 'High' || p.prediction.riskLevel === 'Severe').length}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RiskMap;
