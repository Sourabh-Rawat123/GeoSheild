import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

// Create axios instance to avoid modifying global axios
const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add token to requests
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Handle 401 errors globally
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

const predictionService = {
    // Get single prediction
    getSinglePrediction: async (latitude, longitude, features = null) => {
        const response = await apiClient.post('/predictions/single', {
            latitude,
            longitude,
            features,
        });
        return response.data;
    },

    // Get batch predictions
    getBatchPredictions: async (locations) => {
        const response = await apiClient.post('/predictions/batch', {
            locations,
        });
        return response.data;
    },

    // Get risk zones heatmap
    getRiskZones: async (bounds, resolution = 50) => {
        const response = await apiClient.get('/predictions/risk-zones', {
            params: {
                min_lat: bounds.min_lat,
                min_lon: bounds.min_lon,
                max_lat: bounds.max_lat,
                max_lon: bounds.max_lon,
                resolution,
            },
        });
        return response.data;
    },
};

export default predictionService;
