const Sidebar = ({ open, setOpen }) => {
    return (
        <aside className={`bg-gray-800 text-white w-64 fixed inset-y-0 left-0 transform ${open ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition duration-200 ease-in-out z-30`}>
            <div className="p-6">
                <h2 className="text-2xl font-bold">GeoShield AI</h2>
            </div>
            <nav className="mt-6">
                <a href="/dashboard" className="block py-2.5 px-6 hover:bg-gray-700">Dashboard</a>
                <a href="/route-analysis" className="block py-2.5 px-6 hover:bg-gray-700">Route Analysis</a>
                <a href="/risk-map" className="block py-2.5 px-6 hover:bg-gray-700">Risk Map</a>
                <a href="/alerts" className="block py-2.5 px-6 hover:bg-gray-700">Alerts</a>
                <a href="/profile" className="block py-2.5 px-6 hover:bg-gray-700">Profile</a>
            </nav>
        </aside>
    );
};

export default Sidebar;
