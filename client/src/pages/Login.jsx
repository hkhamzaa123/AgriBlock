import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { LogIn, Loader2 } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        username,
        password
      });

      if (response.data.success) {
        // Save user data and token
        login(response.data.user, response.data.token);

        // Redirect based on role
        const role = response.data.user.role?.toUpperCase();
        
        if (role === 'ADMIN') {
          navigate('/admin');
        } else if (role === 'FARMER') {
          navigate('/dashboard/farmer');
        } else if (role === 'DISTRIBUTOR') {
          navigate('/dashboard/distributor');
        } else if (role === 'TRANSPORTER') {
          navigate('/dashboard/transporter');
        } else if (role === 'RETAILER') {
          navigate('/dashboard/shopkeeper'); // Map RETAILER to shopkeeper route for backward compatibility
        } else if (role === 'CONSUMER') {
          navigate('/dashboard/consumer');
        } else {
          // Fallback to generic dashboard
          navigate('/dashboard/farmer');
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 
        'Login failed. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <LogIn className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">AgriChain</h1>
          <p className="text-gray-600">Agricultural Supply Chain Management</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username Field */}
          <div>
            <label 
              htmlFor="username" 
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
              placeholder="Enter your username"
              disabled={loading}
            />
          </div>

          {/* Password Field */}
          <div>
            <label 
              htmlFor="password" 
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Enter System</span>
              </>
            )}
          </button>
        </form>

        {/* Sign Up Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link 
              to="/signup" 
              className="text-green-600 hover:text-green-700 font-semibold hover:underline"
            >
              Sign Up
            </Link>
          </p>
        </div>

        {/* Demo Credentials Hint */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Demo users: farmer_joe, distributor_dave, transporter_tom, retailer_sarah, consumer_carl
            <br />
            Password: password123
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

