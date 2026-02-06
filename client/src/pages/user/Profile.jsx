import React, { useEffect, useState } from 'react';
import { InformationCircleIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import authService from '@services/authService';

const Profile = () => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            setError('');
            try {
                const user = await authService.getCurrentUser();
                setProfile(user);
            } catch (err) {
                setError('Failed to load profile.');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name.startsWith('alertPreferences.')) {
            const prefKey = name.split('.')[1];
            if (prefKey === 'smsEnabled') {
                setProfile((prev) => ({
                    ...prev,
                    alertPreferences: {
                        ...prev.alertPreferences,
                        sms: {
                            ...prev.alertPreferences?.sms,
                            enabled: checked,
                        },
                    },
                }));
            } else if (prefKey === 'smsPhone') {
                setProfile((prev) => ({
                    ...prev,
                    alertPreferences: {
                        ...prev.alertPreferences,
                        sms: {
                            ...prev.alertPreferences?.sms,
                            phone: value,
                        },
                    },
                }));
            } else if (prefKey === 'severityThreshold') {
                setProfile((prev) => ({
                    ...prev,
                    alertPreferences: {
                        ...prev.alertPreferences,
                        severityThreshold: value,
                    },
                }));
            }
        } else if (name.startsWith('location.')) {
            const locKey = name.split('.')[1];
            setProfile((prev) => ({
                ...prev,
                location: {
                    ...prev.location,
                    [locKey]: value,
                },
            }));
        } else {
            setProfile((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const updateData = {
                name: profile.name,
                location: {
                    type: 'Point',
                    coordinates: profile.location?.coordinates || [0, 0],
                    address: profile.location?.address || '',
                    city: profile.location?.city || '',
                    state: profile.location?.state || '',
                },
                alertPreferences: {
                    sms: {
                        enabled: profile.alertPreferences?.sms?.enabled || false,
                        phone: profile.alertPreferences?.sms?.phone || '',
                    },
                    severityThreshold: profile.alertPreferences?.severityThreshold || 'Moderate',
                },
            };

            console.log('Updating profile with:', updateData);
            await authService.updateProfile(updateData);
            setSuccess('Profile updated successfully!');
        } catch (err) {
            console.error('Profile update error:', err);
            setError(err.response?.data?.message || 'Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    const handleUseCurrentLocation = async () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser.');
            setSuccess('');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        // Check permission status first (if available)
        try {
            if (navigator.permissions) {
                const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
                console.log('Geolocation permission status:', permissionStatus.state);

                if (permissionStatus.state === 'denied') {
                    setLoading(false);
                    setSuccess('');
                    setError('❌ Location access is blocked. Please enable it in your browser settings:\n1. Click the lock/info icon in the address bar\n2. Find "Location" permission\n3. Change to "Allow"\n4. Refresh this page');
                    return;
                }
            }
        } catch (permErr) {
            console.log('Permission API not available:', permErr);
        }

        // Request location
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;

                    console.log('✓ Got coordinates:', latitude, longitude);

                    // Reverse geocode to get city and state
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                        {
                            headers: {
                                'User-Agent': 'GeoShield-App'
                            }
                        }
                    );
                    const data = await response.json();

                    const city = data.address?.city || data.address?.town || data.address?.village || 'Unknown';
                    const state = data.address?.state || 'Unknown';
                    const address = data.display_name || '';

                    setProfile((prev) => ({
                        ...prev,
                        location: {
                            coordinates: [longitude, latitude],
                            address: address,
                            city: city,
                            state: state,
                        },
                    }));

                    setError('');
                    setSuccess(`✓ Location detected: ${city}, ${state}. Click "Save Changes" to update.`);
                    setLoading(false);
                } catch (err) {
                    console.error('Geocoding error:', err);
                    // Fallback if geocoding fails
                    setProfile((prev) => ({
                        ...prev,
                        location: {
                            coordinates: [position.coords.latitude, position.coords.longitude],
                            address: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
                            city: profile.location?.city || '',
                            state: profile.location?.state || '',
                        },
                    }));
                    setError('');
                    setSuccess('✓ GPS coordinates detected! Update city/state manually and click "Save Changes".');
                    setLoading(false);
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                console.error('Error code:', error.code, 'Message:', error.message);

                setSuccess(''); // Clear any previous success messages

                let errorMessage = '';
                let helpText = '';

                switch (error.code) {
                    case 1: // PERMISSION_DENIED
                        errorMessage = '❌ Location permission denied.';
                        helpText = '\n\nTo fix this:\n1. Click the 🔒 or ⓘ icon in your browser\'s address bar\n2. Find "Location" permissions\n3. Select "Allow"\n4. Refresh the page and try again';
                        break;
                    case 2: // POSITION_UNAVAILABLE
                        errorMessage = '❌ Location unavailable.';
                        helpText = '\n\nPossible fixes:\n• Check if location services are enabled on your device\n• Ensure you have an internet connection\n• Try restarting your browser';
                        break;
                    case 3: // TIMEOUT
                        errorMessage = '❌ Location request timed out.';
                        helpText = '\n\nTry:\n• Moving closer to a window\n• Enabling Wi-Fi\n• Clicking the button again';
                        break;
                    default:
                        errorMessage = `❌ Location error: ${error.message}`;
                        helpText = '\n\nTry refreshing the page or using a different browser.';
                }

                setError(errorMessage + helpText);
                setLoading(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000, // Increased timeout to 15 seconds
                maximumAge: 0
            }
        );
    };

    if (loading && !profile) {
        return <div className="p-8 text-gray-600 dark:text-gray-300">Loading profile...</div>;
    }
    if (!profile) return null;

    return (
        <div className="max-w-2xl mx-auto mt-10">
            <div className="bg-gradient-to-r from-blue-600 to-blue-400 rounded-t-lg px-6 py-5 flex items-center gap-3 shadow-lg">
                <UserCircleIcon className="h-10 w-10 text-white" />
                <div>
                    <h1 className="text-2xl font-bold text-white">Profile Settings</h1>
                    <p className="text-blue-100 text-sm">Manage your profile and alert preferences</p>
                </div>
            </div>
            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-b-lg shadow-lg p-8 space-y-8 border-t-4 border-blue-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-gray-700 dark:text-gray-200 font-semibold mb-1">Name</label>
                        <input
                            type="text"
                            name="name"
                            value={profile.name || ''}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:text-white"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 dark:text-gray-200 font-semibold mb-1">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={profile.email || ''}
                            disabled
                            className="w-full px-3 py-2 border rounded bg-gray-100 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-gray-700 dark:text-gray-200 font-semibold mb-1">City</label>
                        <input
                            type="text"
                            name="location.city"
                            value={profile.location?.city || ''}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 dark:text-gray-200 font-semibold mb-1">State</label>
                        <input
                            type="text"
                            name="location.state"
                            value={profile.location?.state || ''}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                </div>

                {/* GPS Coordinates Display */}
                {profile.location?.coordinates && (
                    <div className="bg-blue-50 dark:bg-gray-700 p-4 rounded border border-blue-200 dark:border-gray-600">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            <strong>📍 GPS Coordinates:</strong> {profile.location.coordinates[1]?.toFixed(4)}, {profile.location.coordinates[0]?.toFixed(4)}
                        </p>
                    </div>
                )}

                {/* Use Current Location Button */}
                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded shadow transition-all duration-200 disabled:opacity-60"
                    >
                        {loading ? '⏳ Detecting Location...' : '📍 Use Current Location'}
                    </button>
                    <p className="text-xs text-gray-500">Click to automatically detect your current location using GPS</p>

                    {/* Inline success/error messages for location detection */}
                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                            {success}
                        </div>
                    )}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded whitespace-pre-line">
                            {error}
                        </div>
                    )}
                </div>

                <div className="border-t pt-6">
                    <div className="flex items-center gap-2 mb-2">
                        <InformationCircleIcon className="h-5 w-5 text-blue-500" />
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Alert Preferences</h2>
                    </div>
                    <div className="flex items-center mb-3">
                        <input
                            type="checkbox"
                            name="alertPreferences.smsEnabled"
                            checked={profile.alertPreferences?.sms?.enabled || false}
                            onChange={handleChange}
                            className="mr-2 accent-blue-600"
                        />
                        <label className="text-gray-700 dark:text-gray-200">Enable SMS Alerts</label>
                    </div>
                    <div className="mb-3">
                        <label className="block text-gray-700 dark:text-gray-200 font-semibold mb-1">Phone Number</label>
                        <input
                            type="text"
                            name="alertPreferences.smsPhone"
                            value={profile.alertPreferences?.sms?.phone || ''}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="text-gray-700 dark:text-gray-200 font-semibold mb-1 flex items-center gap-1">
                            Severity Threshold
                            <span className="ml-1 text-xs text-gray-400">(Minimum risk level for alerts)</span>
                        </label>
                        <select
                            name="alertPreferences.severityThreshold"
                            value={profile.alertPreferences?.severityThreshold || 'Moderate'}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:text-white"
                        >
                            <option value="Low">Low (All alerts)</option>
                            <option value="Moderate">Moderate (Only moderate & high)</option>
                            <option value="High">High (Only high severity)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">You will only receive alerts for incidents at or above this severity.</p>
                    </div>
                </div>

                <button
                    type="submit"
                    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold px-8 py-2 rounded shadow-lg transition-all duration-200 disabled:opacity-60 mt-2"
                    disabled={saving}
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </form>
        </div>
    );
};

export default Profile;
