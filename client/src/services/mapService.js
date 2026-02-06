import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

// Get stored token
const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// Fetch active predictions
export const getActivePredictions = async (lat, lon, radius = 50) => {
    const response = await axios.get(`${API_URL}/predictions/active`, {
        params: { lat, lon, radius },
        headers: getAuthHeader()
    });
    return response.data;
};

// Fetch historical incidents
export const getHistoricalIncidents = async (lat, lon, radius = 100) => {
    const params = {};
    if (lat && lon) {
        params.lat = lat;
        params.lon = lon;
        params.radius = radius;
    }

    const response = await axios.get(`${API_URL}/predictions/historical`, {
        params,
        headers: getAuthHeader()
    });
    return response.data;
};

// Get current weather
export const getCurrentWeather = async (lat, lon) => {
    const response = await axios.get(`${API_URL}/weather/current`, {
        params: { lat, lon },
        headers: getAuthHeader()
    });
    return response.data;
};

// Get rainfall alert
export const getRainfallAlert = async (lat, lon) => {
    const response = await axios.get(`${API_URL}/weather/rainfall-alert`, {
        params: { lat, lon },
        headers: getAuthHeader()
    });
    return response.data;
};

// Store prediction
export const storePrediction = async (predictionData) => {
    const response = await axios.post(`${API_URL}/predictions/store`, predictionData, {
        headers: getAuthHeader()
    });
    return response.data;
};

// Seed historical incidents
export const seedHistoricalData = async () => {
    try {
        const response = await axios.post(`${API_URL}/seed/historical`, {}, {
            headers: getAuthHeader()
        });
        return response.data;
    } catch (error) {
        console.error('Failed to seed historical data:', error);
        return null;
    }
};

// Check seed status
export const checkSeedStatus = async () => {
    try {
        const response = await axios.get(`${API_URL}/seed/status`, {
            headers: getAuthHeader()
        });
        return response.data;
    } catch (error) {
        console.error('Failed to check seed status:', error);
        return null;
    }
};

export default {
    getActivePredictions,
    getHistoricalIncidents,
    getCurrentWeather,
    getRainfallAlert,
    storePrediction,
    seedHistoricalData,
    checkSeedStatus
};
