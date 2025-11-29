import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, Plus, Package, Loader2, Calendar, Sprout, X, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const FarmerDashboard = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('my-crops');
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [loggingEvent, setLoggingEvent] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    crop_name: '',
    variety: '',
    planting_date: '',
    soil_type: 'CLAY',
    irrigation_source: ''
  });

  // Event logging form state
  const [eventFormData, setEventFormData] = useState({
    event_type: 'CHEMICAL',
    // Chemical fields
    chemical_name: '',
    quantity: '',
    applied_date: '',
    notes: '',
    // Harvest fields
    machine_type: '',
    machine_model: '',
    yield_qty: ''
  });

  // Fetch batches on component mount and when tab switches to my-crops
  useEffect(() => {
    if (activeTab === 'my-crops') {
      fetchBatches();
    }
  }, [activeTab, token]);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/farmer/my-batches`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setBatches(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
      alert('Failed to load batches. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/farmer/add-batch`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        alert('Batch Created Successfully!');
        // Reset form
        setFormData({
          crop_name: '',
          variety: '',
          planting_date: '',
          soil_type: 'CLAY',
          irrigation_source: ''
        });
        // Switch to My Crops tab and refresh
        setActiveTab('my-crops');
        fetchBatches();
      }
    } catch (error) {
      console.error('Error creating batch:', error);
      alert(error.response?.data?.message || 'Failed to create batch. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const openEventModal = (batch) => {
    setSelectedBatch(batch);
    setEventFormData({
      event_type: 'CHEMICAL',
      chemical_name: '',
      quantity: '',
      applied_date: '',
      notes: '',
      machine_type: '',
      machine_model: '',
      yield_qty: ''
    });
  };

  const closeEventModal = () => {
    setSelectedBatch(null);
    setEventFormData({
      event_type: 'CHEMICAL',
      chemical_name: '',
      quantity: '',
      applied_date: '',
      notes: '',
      machine_type: '',
      machine_model: '',
      yield_qty: ''
    });
  };

  const handleEventInputChange = (e) => {
    setEventFormData({
      ...eventFormData,
      [e.target.name]: e.target.value
    });
  };

  const handleEventSubmit = async (e) => {
    e.preventDefault();
    setLoggingEvent(true);

    try {
      // Prepare data object based on event type
      let eventData = {};
      
      if (eventFormData.event_type === 'CHEMICAL') {
        eventData = {
          chemical_name: eventFormData.chemical_name,
          quantity: eventFormData.quantity ? parseFloat(eventFormData.quantity) : null,
          applied_date: eventFormData.applied_date,
          notes: eventFormData.notes || null
        };
      } else if (eventFormData.event_type === 'HARVEST') {
        eventData = {
          machine_type: eventFormData.machine_type,
          machine_model: eventFormData.machine_model || null,
          yield_qty: parseFloat(eventFormData.yield_qty)
        };
      }

      const response = await axios.post(
        `${API_BASE_URL}/farmer/log-event`,
        {
          batch_id: selectedBatch.batch_id,
          event_type: eventFormData.event_type,
          data: eventData
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        alert('Event logged successfully!');
        closeEventModal();
        // Refresh batches to see updated status
        fetchBatches();
      }
    } catch (error) {
      console.error('Error logging event:', error);
      alert(error.response?.data?.message || 'Failed to log event. Please try again.');
    } finally {
      setLoggingEvent(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      PLANTED: 'bg-green-100 text-green-800',
      HARVESTED: 'bg-yellow-100 text-yellow-800',
      SOLD_TO_DISTRIBUTOR: 'bg-blue-100 text-blue-800',
      IN_TRANSIT: 'bg-purple-100 text-purple-800',
      IN_SHOP: 'bg-indigo-100 text-indigo-800',
      SOLD_TO_CONSUMER: 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const truncateBatchId = (batchId) => {
    if (!batchId) return 'N/A';
    return `${batchId.substring(0, 8)}...${batchId.substring(batchId.length - 4)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Farmer Dashboard</h1>
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('my-crops')}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'my-crops'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Package className="w-5 h-5" />
                My Crops
              </button>
              <button
                onClick={() => setActiveTab('new-batch')}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'new-batch'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Plus className="w-5 h-5" />
                New Batch
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'my-crops' && (
          <div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">My Crop Batches</h2>
                <button
                  onClick={fetchBatches}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                  <span className="ml-3 text-gray-600">Loading batches...</span>
                </div>
              ) : batches.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No crop batches yet</p>
                  <p className="text-gray-400 text-sm mt-2">Create your first batch to get started</p>
                  <button
                    onClick={() => setActiveTab('new-batch')}
                    className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Create New Batch
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {batches.map((batch) => (
                    <div
                      key={batch.batch_id}
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      {/* Card Header */}
                      <div className="mb-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-lg font-bold text-gray-800">{batch.crop_name}</h3>
                            <p className="text-sm text-gray-600">{batch.variety}</p>
                          </div>
                          <Sprout className="w-6 h-6 text-green-600 flex-shrink-0" />
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="font-medium">Batch ID:</span>
                          <span className="font-mono text-xs">{truncateBatchId(batch.batch_id)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>Planted: {formatDate(batch.planting_date)}</span>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="pt-4 border-t border-gray-200 space-y-3">
                        <div>{getStatusBadge(batch.status)}</div>
                        <button
                          onClick={() => openEventModal(batch)}
                          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                        >
                          <Activity className="w-4 h-4" />
                          Log Event
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'new-batch' && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Crop Batch</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Crop Name */}
                <div>
                  <label htmlFor="crop_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Crop Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="crop_name"
                    name="crop_name"
                    value={formData.crop_name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                    placeholder="e.g., Wheat, Rice, Corn"
                  />
                </div>

                {/* Variety */}
                <div>
                  <label htmlFor="variety" className="block text-sm font-medium text-gray-700 mb-2">
                    Variety <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="variety"
                    name="variety"
                    value={formData.variety}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                    placeholder="e.g., Gold-2024, Premium-Hybrid"
                  />
                </div>

                {/* Planting Date */}
                <div>
                  <label htmlFor="planting_date" className="block text-sm font-medium text-gray-700 mb-2">
                    Planting Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="planting_date"
                    name="planting_date"
                    value={formData.planting_date}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                  />
                </div>

                {/* Soil Type */}
                <div>
                  <label htmlFor="soil_type" className="block text-sm font-medium text-gray-700 mb-2">
                    Soil Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="soil_type"
                    name="soil_type"
                    value={formData.soil_type}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all bg-white"
                  >
                    <option value="CLAY">CLAY</option>
                    <option value="SANDY">SANDY</option>
                    <option value="LOAM">LOAM</option>
                    <option value="SILT">SILT</option>
                  </select>
                </div>

                {/* Irrigation Source */}
                <div className="md:col-span-2">
                  <label htmlFor="irrigation_source" className="block text-sm font-medium text-gray-700 mb-2">
                    Irrigation Source
                  </label>
                  <input
                    type="text"
                    id="irrigation_source"
                    name="irrigation_source"
                    value={formData.irrigation_source}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                    placeholder="e.g., Borewell, Canal, Rain-fed"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      crop_name: '',
                      variety: '',
                      planting_date: '',
                      soil_type: 'CLAY',
                      irrigation_source: ''
                    });
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  disabled={submitting}
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Create Batch
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Event Logging Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Log Event</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedBatch.crop_name} - {selectedBatch.variety}
                </p>
              </div>
              <button
                onClick={closeEventModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleEventSubmit} className="p-6 space-y-6">
              {/* Event Type Selection */}
              <div>
                <label htmlFor="event_type" className="block text-sm font-medium text-gray-700 mb-2">
                  Event Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="event_type"
                  name="event_type"
                  value={eventFormData.event_type}
                  onChange={handleEventInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all bg-white"
                >
                  <option value="CHEMICAL">Chemical Application</option>
                  <option value="HARVEST">Harvest</option>
                </select>
              </div>

              {/* Dynamic Fields Based on Event Type */}
              {eventFormData.event_type === 'CHEMICAL' ? (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="chemical_name" className="block text-sm font-medium text-gray-700 mb-2">
                      Chemical Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="chemical_name"
                      name="chemical_name"
                      value={eventFormData.chemical_name}
                      onChange={handleEventInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                      placeholder="e.g., Urea, Pesticide-X"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                        Quantity (kg/liters)
                      </label>
                      <input
                        type="number"
                        id="quantity"
                        name="quantity"
                        value={eventFormData.quantity}
                        onChange={handleEventInputChange}
                        step="0.01"
                        min="0"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                        placeholder="e.g., 50.5"
                      />
                    </div>

                    <div>
                      <label htmlFor="applied_date" className="block text-sm font-medium text-gray-700 mb-2">
                        Applied Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        id="applied_date"
                        name="applied_date"
                        value={eventFormData.applied_date}
                        onChange={handleEventInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={eventFormData.notes}
                      onChange={handleEventInputChange}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                      placeholder="Additional notes about the application..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="machine_type" className="block text-sm font-medium text-gray-700 mb-2">
                      Machine Type <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="machine_type"
                      name="machine_type"
                      value={eventFormData.machine_type}
                      onChange={handleEventInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                      placeholder="e.g., Combine Harvester"
                    />
                  </div>

                  <div>
                    <label htmlFor="machine_model" className="block text-sm font-medium text-gray-700 mb-2">
                      Machine Model
                    </label>
                    <input
                      type="text"
                      id="machine_model"
                      name="machine_model"
                      value={eventFormData.machine_model}
                      onChange={handleEventInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                      placeholder="e.g., S-Series, Model-2024"
                    />
                  </div>

                  <div>
                    <label htmlFor="yield_qty" className="block text-sm font-medium text-gray-700 mb-2">
                      Yield Quantity (kg) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="yield_qty"
                      name="yield_qty"
                      value={eventFormData.yield_qty}
                      onChange={handleEventInputChange}
                      required
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                      placeholder="e.g., 5000.50"
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeEventModal}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  disabled={loggingEvent}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loggingEvent}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loggingEvent ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Logging...
                    </>
                  ) : (
                    <>
                      <Activity className="w-5 h-5" />
                      Log Event
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarmerDashboard;
