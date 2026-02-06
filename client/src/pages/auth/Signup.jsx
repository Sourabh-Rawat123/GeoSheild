import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { signup, updateUser } from '@features/auth/authSlice';
import toast from 'react-hot-toast';
import authService from '@services/authService';

const Signup = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [requestingLocation, setRequestingLocation] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { isLoading } = useSelector((state) => state.auth);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const requestLocationAccess = async () => {
        if (!navigator.geolocation) {
            console.error('Geolocation is not supported');
            return { error: 'not_supported' };
        }

        // Check permission status first if available
        if (navigator.permissions) {
            try {
                const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
                console.log('Location permission status:', permissionStatus.state);

                if (permissionStatus.state === 'denied') {
                    console.log('Location permission is denied');
                    return { error: 'denied' };
                }
            } catch (err) {
                console.log('Permission API not available, will try direct request:', err);
            }
        }

        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                console.log('Location request timed out');
                resolve({ error: 'timeout' });
            }, 20000);

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    clearTimeout(timeoutId);
                    try {
                        const { latitude, longitude } = position.coords;
                        console.log('Got GPS coordinates:', latitude, longitude);

                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                            { headers: { 'User-Agent': 'GeoShield-App' } }
                        );
                        const data = await response.json();

                        const city = data.address?.city || data.address?.town || data.address?.village || 'Unknown';
                        const state = data.address?.state || 'Unknown';
                        const address = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

                        resolve({
                            success: true,
                            coordinates: [longitude, latitude],
                            address,
                            city,
                            state,
                        });
                    } catch (err) {
                        console.error('Geocoding error:', err);
                        resolve({
                            success: true,
                            coordinates: [position.coords.longitude, position.coords.latitude],
                            address: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
                            city: 'Unknown',
                            state: 'Unknown',
                        });
                    }
                },
                (error) => {
                    clearTimeout(timeoutId);
                    console.error('Geolocation error:', error.code, error.message);

                    if (error.code === 1) {
                        resolve({ error: 'denied' });
                    } else if (error.code === 2) {
                        resolve({ error: 'unavailable' });
                    } else if (error.code === 3) {
                        resolve({ error: 'timeout' });
                    } else {
                        resolve({ error: 'unknown' });
                    }
                },
                { timeout: 20000, enableHighAccuracy: true, maximumAge: 0 }
            );
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        const result = await dispatch(
            signup({
                name: formData.name,
                email: formData.email,
                password: formData.password,
            })
        );

        if (signup.fulfilled.match(result)) {
            toast.success('Account created successfully!');

            // Request location access after signup
            setRequestingLocation(true);
            toast.loading('Requesting location access...', { id: 'location-request' });

            const locationData = await requestLocationAccess();

            if (locationData?.success) {
                try {
                    const updatedUser = await authService.updateProfile({
                        location: {
                            type: 'Point',
                            coordinates: locationData.coordinates,
                            address: locationData.address,
                            city: locationData.city,
                            state: locationData.state,
                        },
                    });

                    dispatch(updateUser(updatedUser));
                    toast.success(`Location set: ${locationData.city}, ${locationData.state}`, { id: 'location-request' });
                } catch (err) {
                    console.error('Failed to update location:', err);
                    toast.dismiss('location-request');
                    toast.error('Location detected but failed to save. You can set it in Profile.');
                }
            } else {
                // Handle different error types
                toast.dismiss('location-request');

                if (locationData?.error === 'denied') {
                    toast.error('Location access denied. To enable:\n1. Click the 🔒 icon in address bar\n2. Allow Location\n3. Refresh and login again\n\nOr set location manually in Profile.', { duration: 8000 });
                } else if (locationData?.error === 'unavailable') {
                    toast.error('Location unavailable. Please check your device settings and try again, or set location manually in Profile.');
                } else if (locationData?.error === 'timeout') {
                    toast.error('Location request timed out. Please try again or set location manually in Profile.');
                } else if (locationData?.error === 'not_supported') {
                    toast.error('Your browser does not support geolocation. Please set location manually in Profile.');
                } else {
                    toast('Location access not available. You can set it manually in Profile.', { icon: 'ℹ️' });
                }
            }

            setRequestingLocation(false);
            navigate('/dashboard');
        } else {
            // Ensure we always pass a string to toast.error
            const errorMessage = typeof result.payload === 'string'
                ? result.payload
                : result.payload?.message || result.payload?.error || 'Signup failed';
            toast.error(errorMessage);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 py-8 px-6 shadow-xl rounded-lg">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Create your account
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Full Name
                    </label>
                    <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                </div>

                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Email address
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Password
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        minLength={8}
                        value={formData.password}
                        onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Confirm Password
                    </label>
                    <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        required
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading || requestingLocation}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Creating account...' : requestingLocation ? 'Setting up location...' : 'Sign up'}
                </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
                    Sign in
                </Link>
            </p>
        </div>
    );
};

export default Signup;
