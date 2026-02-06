const Landing = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="container mx-auto px-4 py-16">
                <div className="text-center">
                    <h1 className="text-5xl font-bold text-gray-900 mb-4">
                        GeoShield AI
                    </h1>
                    <p className="text-xl text-gray-600 mb-8">
                        Intelligent Landslide Prediction & Early Warning Platform
                    </p>
                    <div className="space-x-4">
                        <a
                            href="/login"
                            className="inline-block px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                        >
                            Get Started
                        </a>
                        <a
                            href="/signup"
                            className="inline-block px-8 py-3 bg-white text-primary-600 rounded-lg border border-primary-600 hover:bg-gray-50"
                        >
                            Sign Up
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Landing;
