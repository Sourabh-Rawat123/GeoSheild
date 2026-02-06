import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import MainLayout from '@layouts/MainLayout'
import AuthLayout from '@layouts/AuthLayout'

// Public pages
import Landing from '@pages/public/Landing'
import Login from '@pages/auth/Login'
import Signup from '@pages/auth/Signup'
import ForgotPassword from '@pages/auth/ForgotPassword'

// User pages
import UserDashboard from '@pages/user/Dashboard'
import RiskMap from '@pages/user/RiskMap'
import Alerts from '@pages/user/Alerts'
import RouteAnalysis from '@pages/user/RouteAnalysis'
import Profile from '@pages/user/Profile'

import NotFound from '@pages/NotFound'

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated } = useSelector((state) => state.auth)

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    return children
}

function App() {
    return (
        <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />

            {/* Auth routes */}
            <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
            </Route>

            {/* Protected user routes */}
            <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<UserDashboard />} />
                <Route path="/risk-map" element={<RiskMap />} />
                <Route path="/map" element={<Navigate to="/risk-map" replace />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/route-analysis" element={<RouteAnalysis />} />
                <Route path="/profile" element={<Profile />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
        </Routes>
    )
}

export default App
