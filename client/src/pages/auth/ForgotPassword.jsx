import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
            await axios.post(`${API_URL}/auth/forgot-password`, { email });

            setSubmitted(true);
            toast.success('If an account exists with this email, you will receive reset instructions.');
        } catch (error) {
            console.error('Forgot password error:', error);
            // Don't reveal if email exists or not for security
            setSubmitted(true);
            toast.success('If an account exists with this email, you will receive reset instructions.');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="bg-white dark:bg-gray-800 py-8 px-6 shadow-xl rounded-lg">
                <div className="text-center">
                    <div className="text-6xl mb-4">✉️</div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                        Check your email
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        If an account exists with <strong>{email}</strong>, you will receive password reset instructions shortly.
                    </p>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>⚠️ Note:</strong> Email service is not configured. Please contact admin for password reset.
                        </p>
                    </div>
                    <Link
                        to="/login"
                        className="text-primary-600 hover:text-primary-500 font-medium"
                    >
                        ← Back to login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 py-8 px-6 shadow-xl rounded-lg">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Reset your password
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
                Enter your email address and we'll send you instructions to reset your password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Email address
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Sending...' : 'Send reset instructions'}
                </button>
                <div className="text-center">
                    <Link
                        to="/login"
                        className="text-sm text-primary-600 hover:text-primary-500"
                    >
                        ← Back to login
                    </Link>
                </div>
            </form>
        </div>
    );
};

export default ForgotPassword;
