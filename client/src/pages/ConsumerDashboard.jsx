import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ConsumerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Consumer Dashboard</h1>
              <p className="text-sm text-gray-500">Welcome, {user?.username}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            Consumer Dashboard
          </h2>
          <p className="text-gray-600 mb-6">
            This is the Consumer dashboard. Here you will be able to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>Browse available crops from shopkeepers</li>
            <li>Purchase crops</li>
            <li>Scan QR codes to view full crop history</li>
            <li>View traceability information (grower, chemicals, transporters)</li>
            <li>Provide feedback and ratings</li>
            <li>View purchase history</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default ConsumerDashboard;





