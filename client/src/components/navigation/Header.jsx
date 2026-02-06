import { useSelector, useDispatch } from 'react-redux';
import { logout } from '@features/auth/authSlice';
import { useNavigate } from 'react-router-dom';

const Header = ({ onMenuClick }) => {
    const { user } = useSelector((state) => state.auth);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    return (
        <header className="bg-white dark:bg-gray-800 shadow-sm">
            <div className="flex items-center justify-between px-6 py-4">
                <button onClick={onMenuClick} className="md:hidden">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>

                <div className="flex items-center space-x-4">
                    <span className="text-gray-700 dark:text-gray-300">{user?.name}</span>
                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
