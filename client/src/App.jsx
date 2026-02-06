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

// Admin pages
import AdminDashboard from '@pages/admin/Dashboard'
import UserManagement from '@pages/admin/UserManagement'
import SystemLogs from '@pages/admin/SystemLogs'
import ModelManagement from '@pages/admin/ModelManagement'

// Analyst pages
import AnalystDashboard from '@pages/analyst/Dashboard'
import DataExplorer from '@pages/analyst/DataExplorer'
import FeatureAnalysis from '@pages/analyst/FeatureAnalysis'
import ModelComparison from '@pages/analyst/ModelComparison'

import NotFound from '@pages/NotFound'

// Protected Route wrapper
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const { isAuthenticated, user } = useSelector((state) => state.auth)

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
        return <Navigate to="/dashboard" replace />
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

            {/* Protected routes */}
            <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                {/* User routes */}
                <Route path="/dashboard" element={<UserDashboard />} />
                <Route path="/map" element={<RiskMap />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/route-analysis" element={<RouteAnalysis />} />
                <Route path="/profile" element={<Profile />} />

                {/* Admin routes */}
                <Route
                    path="/admin"
                    element={
                        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                            <AdminDashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/users"
                    element={
                        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                            <UserManagement />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/logs"
                    element={
                        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                            <SystemLogs />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/models"
                    element={
                        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                            <ModelManagement />
                        </ProtectedRoute>
                    }
                />

                {/* Analyst routes */}
                <Route
                    path="/analyst"
                    element={
                        <ProtectedRoute allowedRoles={['analyst', 'admin', 'super_admin']}>
                            <AnalystDashboard />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/analyst/data"
                    element={
                        <ProtectedRoute allowedRoles={['analyst', 'admin', 'super_admin']}>
                            <DataExplorer />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/analyst/features"
                    element={
                        <ProtectedRoute allowedRoles={['analyst', 'admin', 'super_admin']}>
                            <FeatureAnalysis />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/analyst/models"
                    element={
                        <ProtectedRoute allowedRoles={['analyst', 'admin', 'super_admin']}>
                            <ModelComparison />
                        </ProtectedRoute>
                    }
                />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
        </Routes>
    )
}

export default App
