const ForgotPassword = () => {
    return (
        <div className="bg-white dark:bg-gray-800 py-8 px-6 shadow-xl rounded-lg">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Reset your password
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
                Enter your email address and we'll send you instructions to reset your password.
            </p>
            <form className="space-y-6">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Email address
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                </div>
                <button
                    type="submit"
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                >
                    Send reset instructions
                </button>
            </form>
        </div>
    );
};

export default ForgotPassword;
