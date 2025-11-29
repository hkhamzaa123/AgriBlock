import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Truck, Package, CheckCircle, Loader2, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const TransporterDashboard = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingBatchId, setProcessingBatchId] = useState(null);

  useEffect(() => {
    fetchShipments();
  }, [token]);

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/transporter/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setShipments(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching shipments:', error);
      alert('Failed to load shipments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeliver = async (batchId) => {
    setProcessingBatchId(batchId);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/transporter/deliver`,
        { batch_id: batchId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('Delivery confirmed!');
        setShipments((prev) => prev.filter((shipment) => shipment.batch_id !== batchId));
      }
    } catch (error) {
      console.error('Error delivering batch:', error);
      alert(error.response?.data?.message || 'Failed to confirm delivery.');
    } finally {
      setProcessingBatchId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Truck className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Transporter Dashboard</h1>
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
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Active Shipments</h2>
            <button
              onClick={fetchShipments}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
              <span className="ml-3 text-gray-600">Loading shipments...</span>
            </div>
          ) : shipments.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No shipments in transit</p>
              <p className="text-gray-400 text-sm mt-2">Check back later for new assignments</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {shipments.map((shipment) => (
                <div
                  key={shipment.batch_id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="mb-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">{shipment.crop_name}</h3>
                        <p className="text-sm text-gray-600">{shipment.variety}</p>
                      </div>
                      <Truck className="w-6 h-6 text-orange-600 flex-shrink-0" />
                    </div>
                    <div className="text-xs text-gray-500">
                      Farmer:{' '}
                      <span className="font-medium text-gray-700">{shipment.farmer_username}</span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>Harvested: {formatDate(shipment.harvest_date)}</span>
                    </div>
                    {shipment.distributor_username && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Distributor:</span> {shipment.distributor_username}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleDeliver(shipment.batch_id)}
                      disabled={processingBatchId === shipment.batch_id}
                      className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingBatchId === shipment.batch_id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Confirming...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Confirm Delivery
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default TransporterDashboard;

