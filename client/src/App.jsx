import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import FarmerDashboard from './pages/FarmerDashboard';
import DistributorDashboard from './pages/DistributorDashboard';
import TransporterDashboard from './pages/TransporterDashboard';
import ShopkeeperDashboard from './pages/ShopkeeperDashboard';
import ConsumerDashboard from './pages/ConsumerDashboard';
import ConsumerTrace from './pages/ConsumerTrace';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/trace" element={<ConsumerTrace />} />
          <Route path="/track" element={<ConsumerTrace />} />

          {/* Protected Routes - Role-based Dashboards */}
          <Route
            path="/dashboard/farmer"
            element={
              <ProtectedRoute allowedRoles={['FARMER']}>
                <FarmerDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/distributor"
            element={
              <ProtectedRoute allowedRoles={['DISTRIBUTOR']}>
                <DistributorDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/transporter"
            element={
              <ProtectedRoute allowedRoles={['TRANSPORTER']}>
                <TransporterDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/retailer"
            element={
              <ProtectedRoute allowedRoles={['RETAILER']}>
                <ShopkeeperDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/shopkeeper"
            element={
              <ProtectedRoute allowedRoles={['RETAILER']}>
                <ShopkeeperDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/consumer"
            element={
              <ProtectedRoute allowedRoles={['CONSUMER']}>
                <ConsumerDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Catch all - redirect to login */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

