import React from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo,
        });

        // Log to external service in production
        if (import.meta.env.PROD) {
            // Send to logging service (e.g., Sentry, LogRocket)
            // logErrorToService(error, errorInfo);
        }
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
                    <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full mb-6">
                                <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
                            </div>

                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                                Oops! Something went wrong
                            </h1>

                            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
                                We're sorry for the inconvenience. The application encountered an unexpected error.
                            </p>

                            {import.meta.env.DEV && this.state.error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8 text-left">
                                    <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                                        Error Details (Development Mode):
                                    </h3>
                                    <pre className="text-xs text-red-700 dark:text-red-400 overflow-x-auto whitespace-pre-wrap">
                                        {this.state.error.toString()}
                                    </pre>
                                    {this.state.errorInfo && (
                                        <details className="mt-4">
                                            <summary className="cursor-pointer text-sm font-medium text-red-800 dark:text-red-300">
                                                Component Stack Trace
                                            </summary>
                                            <pre className="text-xs text-red-700 dark:text-red-400 mt-2 overflow-x-auto whitespace-pre-wrap">
                                                {this.state.errorInfo.componentStack}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <button
                                    onClick={this.handleReset}
                                    className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                                >
                                    <RefreshCcw className="w-5 h-5 mr-2" />
                                    Try Again
                                </button>

                                <button
                                    onClick={this.handleGoHome}
                                    className="inline-flex items-center justify-center px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                                >
                                    <Home className="w-5 h-5 mr-2" />
                                    Go Home
                                </button>
                            </div>

                            <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
                                <p>If the problem persists, please contact support.</p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
