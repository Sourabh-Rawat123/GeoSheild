const AdminDashboard = () => {
    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                Admin Dashboard
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Users" value="1,247" />
                <StatCard title="Active Predictions" value="3,421" />
                <StatCard title="System Uptime" value="99.8%" />
                <StatCard title="API Requests" value="142K" />
            </div>
        </div>
    );
};

const StatCard = ({ title, value }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
    </div>
);

export default AdminDashboard;
