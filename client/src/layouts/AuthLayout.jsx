import { Outlet } from 'react-router-dom';

const AuthLayout = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                        GeoShield AI
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Intelligent Landslide Prediction Platform
                    </p>
                </div>
                <Outlet />
            </div>
        </div>
    );
};

export default AuthLayout;
