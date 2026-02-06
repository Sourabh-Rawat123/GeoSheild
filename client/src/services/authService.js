import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

// Create dedicated axios instance for auth service
const authClient = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

const authService = {
    // Update user profile
    updateProfile: async (profileData) => {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Not authenticated');
        const response = await authClient.put(
            '/users/me',
            profileData,
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );
        if (response.data.user) {
            localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        return response.data.user;
    },
    // Login user
    login: async (email, password) => {
        const response = await authClient.post('/auth/login', {
            email,
            password,
        });

        if (response.data.token) {
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
        }

        return response.data;
    },

    // Register user
    signup: async (name, email, password) => {
        const response = await authClient.post('/auth/signup', {
            name,
            email,
            password,
        });

        if (response.data.token) {
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
        }

        return response.data;
    },

    // Logout user
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },

    // Get current user
    getCurrentUser: async () => {
        const token = localStorage.getItem('token');
        if (!token) return null;

        const response = await authClient.post(
            '/auth/verify-token',
            {},
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );

        return response.data.user;
    },
};

export default authService;
