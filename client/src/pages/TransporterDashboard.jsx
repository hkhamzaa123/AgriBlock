import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Truck, Package, CheckCircle, Loader2, Calendar, MapPin, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const TransporterDashboard = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('jobs');
  const [availableJobs, setAvailableJobs] = useState([]);
  const [myDeliveries, setMyDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [statusModal, setStatusModal] = useState(null); // { shipment_id, currentStatus }
  const [locationInput, setLocationInput] = useState('');

  useEffect(() => {
    if (activeTab === 'jobs') {
      fetchAvailableJobs();
    } else {
      fetchMyDeliveries();
    }
  }, [activeTab, token]);

  const fetchAvailableJobs = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/transporter/available-jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setAvailableJobs(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching available jobs:', error);
      alert('Failed to load available jobs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyDeliveries = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/transporter/my-deliveries`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setMyDeliveries(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      alert('Failed to load deliveries. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptJob = async (orderId) => {
    setProcessing(orderId);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/transporter/accept-job`,
        { order_id: orderId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('Job accepted successfully!');
        fetchAvailableJobs();
        setActiveTab('deliveries');
        fetchMyDeliveries();
      } else {
        alert(response.data.message || 'Failed to accept job.');
      }
    } catch (error) {
      console.error('Error accepting job:', error);
      alert(error.response?.data?.message || 'Failed to accept job. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const openStatusModal = (shipment) => {
    setStatusModal({
      shipment_id: shipment.id,
      order_id: shipment.order_id,
      currentStatus: shipment.is_completed ? 'Delivered' : 'In Transit'
    });
    setLocationInput('');
  };

  const closeStatusModal = () => {
    setStatusModal(null);
    setLocationInput('');
  };

  const handleUpdateStatus = async (status) => {
    if (!statusModal) return;

    setProcessing(statusModal.shipment_id);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/transporter/update-status`,
        {
          shipment_id: statusModal.shipment_id,
          status,
          location_coords: locationInput || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert(`Status updated to "${status}" successfully!`);
        closeStatusModal();
        fetchMyDeliveries();
      } else {
        alert(response.data.message || 'Failed to update status.');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert(error.response?.data?.message || 'Failed to update status. Please try again.');
    } finally {
      setProcessing(null);
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
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('jobs')}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'jobs'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Package className="w-5 h-5" />
                Job Board
                {availableJobs.length > 0 && (
                  <span className="bg-orange-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {availableJobs.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('deliveries')}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'deliveries'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Truck className="w-5 h-5" />
                My Deliveries
                {myDeliveries.length > 0 && (
                  <span className="bg-orange-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {myDeliveries.length}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>

        {activeTab === 'jobs' ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Available Jobs</h2>
            <button
                onClick={fetchAvailableJobs}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                <span className="ml-3 text-gray-600">Loading jobs...</span>
            </div>
            ) : availableJobs.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No available jobs</p>
                <p className="text-gray-400 text-sm mt-2">Check back later for new delivery orders</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableJobs.map((job) => {
                  // Calculate estimated shipping fee (base $50 + $0.50 per kg)
                  const estimatedFee = 50 + (job.total_weight || 0) * 0.5;
                  
                  return (
                <div
                      key={job.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                      {/* Header */}
                  <div className="mb-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                            <h3 className="text-lg font-bold text-gray-800">Order #{job.order_number}</h3>
                            <p className="text-xs text-gray-500 mt-1">Order Value: ${parseFloat(job.total_amount || 0).toFixed(2)}</p>
                          </div>
                          <Truck className="w-6 h-6 text-orange-600 flex-shrink-0" />
                        </div>
                      </div>

                      {/* Logistics Ticket Route */}
                      <div className="mb-4 space-y-3">
                        {/* Pickup Location */}
                        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-red-600 font-bold text-sm">🔴 PICKUP FROM:</span>
                          </div>
                          <div className="text-sm font-semibold text-gray-800">
                            {job.pickup_location || `${job.seller_name || job.seller_username || 'Unknown Seller'} (${job.seller_role || 'Unknown'})`}
                          </div>
                          {job.seller_role && (
                            <div className="text-xs text-gray-600 mt-1">
                              {job.seller_role === 'FARMER' ? '📍 Farm Location' : job.seller_role === 'DISTRIBUTOR' ? '📍 Warehouse' : '📍 Location'}
                            </div>
                          )}
                        </div>

                        {/* Route Arrow */}
                        <div className="flex items-center justify-center py-2">
                          <div className="flex flex-col items-center gap-1">
                            <ArrowRight className="w-6 h-6 text-gray-400" />
                            <span className="text-xs text-gray-500 font-medium">Route</span>
                          </div>
                        </div>

                        {/* Dropoff Location */}
                        <div className="p-3 bg-green-50 border-l-4 border-green-500 rounded">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-green-600 font-bold text-sm">🟢 DELIVER TO:</span>
                          </div>
                          <div className="text-sm font-semibold text-gray-800">
                            {job.dropoff_location || `${job.buyer_name || job.buyer_username || 'Unknown Buyer'} (${job.buyer_role || 'Unknown'})`}
                          </div>
                          {job.buyer_role && (
                            <div className="text-xs text-gray-600 mt-1">
                              {job.buyer_role === 'RETAILER' ? '📍 Shop Location' : '📍 Location'}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Job Details */}
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">💰 Fee:</span>
                          <span className="font-bold text-gray-800">${estimatedFee.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">⚖️ Weight:</span>
                          <span className="font-bold text-gray-800">{job.total_weight || 0} kg</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">📦 Items:</span>
                          <span className="font-bold text-gray-800">{job.item_count || 0}</span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="pt-4 border-t border-gray-200">
                        <button
                          onClick={() => handleAcceptJob(job.id)}
                          disabled={processing === job.id}
                          className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processing === job.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Accepting...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Accept Job
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">My Deliveries</h2>
              <button
                onClick={fetchMyDeliveries}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                <span className="ml-3 text-gray-600">Loading deliveries...</span>
              </div>
            ) : myDeliveries.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No active deliveries</p>
                <p className="text-gray-400 text-sm mt-2">Accept jobs from the Job Board to get started</p>
                <button
                  onClick={() => setActiveTab('jobs')}
                  className="mt-4 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  View Job Board
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="mb-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">Order #{delivery.order_number}</h3>
                          <p className="text-sm text-gray-600">Shipment ID: {delivery.id.substring(0, 8)}...</p>
                        </div>
                        <Truck className="w-6 h-6 text-orange-600 flex-shrink-0" />
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4" />
                        <span className="font-medium">From:</span>
                        <span>{delivery.seller_username || 'Distributor'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <ArrowRight className="w-4 h-4" />
                        <span className="font-medium">To:</span>
                        <span>{delivery.buyer_username || 'Retailer'}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Weight:</span> {delivery.total_weight || 0} kg
                    </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Items:</span> {delivery.items_count || 0}
                      </div>
                      {delivery.estimated_delivery && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>Est. Delivery: {formatDate(delivery.estimated_delivery)}</span>
                        </div>
                      )}
                      {delivery.is_completed && (
                        <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold inline-block">
                          Delivered
                      </div>
                    )}
                  </div>

                    <div className="pt-4 border-t border-gray-200 space-y-2">
                      {!delivery.is_completed ? (
                        <>
                    <button
                            onClick={() => openStatusModal(delivery)}
                            className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                            <CheckCircle className="w-4 h-4" />
                            Update Status
                          </button>
                        </>
                      ) : (
                        <div className="text-center text-sm text-gray-500">
                          Order completed
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Status Update Modal */}
        {statusModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800">Update Shipment Status</h3>
                <button onClick={closeStatusModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Location (Optional - GPS Simulation)
                  </label>
                  <input
                    type="text"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    placeholder="e.g., 40.7128°N, 74.0060°W"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => handleUpdateStatus('Picked Up')}
                    disabled={processing === statusModal.shipment_id}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                  >
                    Mark Picked Up
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('In Transit')}
                    disabled={processing === statusModal.shipment_id}
                    className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                  >
                    Mark In Transit
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('Delivered')}
                    disabled={processing === statusModal.shipment_id}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                  >
                    Mark Delivered
                  </button>
                </div>

                {processing === statusModal.shipment_id && (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
            </div>
          )}
        </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default TransporterDashboard;
