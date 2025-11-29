import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, Plus, Package, Loader2, Calendar, Sprout, X, Activity, Box } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const FarmerDashboard = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [loggingEvent, setLoggingEvent] = useState(false);
  
  // Product form state
  const [productFormData, setProductFormData] = useState({
    title: '',
    crop_details: ''
  });

  // Batch form state
  const [batchFormData, setBatchFormData] = useState({
    product_id: '',
    initial_quantity: '',
    quantity_unit: 'kg',
    harvest_date: new Date().toISOString().split('T')[0]
  });

  // Event logging form state
  const [eventFormData, setEventFormData] = useState({
    event_type_name: 'Fertilizer Applied',
    location_coords: '',
    description: ''
  });

  // Fetch products and batches on component mount
  useEffect(() => {
    if (activeTab === 'products') {
      fetchProducts();
    } else if (activeTab === 'batches') {
      fetchBatches();
    }
  }, [activeTab, token]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/farmer/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setProducts(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      alert('Failed to load products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/farmer/batches`, {
        headers: { Authorization: `Bearer ${token}` }
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

  const handleProductInputChange = (e) => {
    setProductFormData({
      ...productFormData,
      [e.target.name]: e.target.value
    });
  };

  const handleBatchInputChange = (e) => {
    setBatchFormData({
      ...batchFormData,
      [e.target.name]: e.target.value
    });
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/farmer/products`,
        productFormData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('Product Created Successfully!');
        setProductFormData({ title: '', crop_details: '' });
        fetchProducts();
      }
    } catch (error) {
      console.error('Error creating product:', error);
      alert(error.response?.data?.message || 'Failed to create product. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/farmer/batches`,
        {
          product_id: batchFormData.product_id,
          initial_quantity: parseFloat(batchFormData.initial_quantity),
          quantity_unit: batchFormData.quantity_unit,
          harvest_date: batchFormData.harvest_date
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert(`Batch Created Successfully! Batch Code: ${response.data.data.batch_code}`);
        setBatchFormData({
          product_id: '',
          initial_quantity: '',
          quantity_unit: 'kg',
          harvest_date: new Date().toISOString().split('T')[0]
        });
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
      event_type_name: 'Fertilizer Applied',
      location_coords: '',
      description: ''
    });
  };

  const closeEventModal = () => {
    setSelectedBatch(null);
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
      const response = await axios.post(
        `${API_BASE_URL}/farmer/events`,
        {
          batch_id: selectedBatch.id,
          event_type_name: eventFormData.event_type_name,
          location_coords: eventFormData.location_coords || null,
          description: eventFormData.description || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('Event logged successfully!');
        closeEventModal();
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
      'Harvested': 'bg-yellow-100 text-yellow-800',
      'In Transit': 'bg-purple-100 text-purple-800',
      'In Warehouse': 'bg-blue-100 text-blue-800',
      'In Shop': 'bg-indigo-100 text-indigo-800',
      'Sold': 'bg-gray-100 text-gray-800',
      'Processing': 'bg-orange-100 text-orange-800'
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
                onClick={() => setActiveTab('products')}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'products'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Box className="w-5 h-5" />
                Products
              </button>
              <button
                onClick={() => setActiveTab('batches')}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'batches'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Package className="w-5 h-5" />
                Batches
              </button>
            </nav>
          </div>
        </div>

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            {/* Create Product Form */}
            <div className="bg-white rounded-lg shadow-sm p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Create Product</h2>
              
              <form onSubmit={handleProductSubmit} className="space-y-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Product Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={productFormData.title}
                    onChange={handleProductInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                    placeholder="e.g., Sahiwal Wheat, Basmati Rice"
                  />
                </div>

                <div>
                  <label htmlFor="crop_details" className="block text-sm font-medium text-gray-700 mb-2">
                    Crop Details
                  </label>
                  <textarea
                    id="crop_details"
                    name="crop_details"
                    value={productFormData.crop_details}
                    onChange={handleProductInputChange}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                    placeholder="Additional details about the crop..."
                  />
                </div>

                <div className="flex justify-end">
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
                        Create Product
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Products List */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">My Products</h2>
                <button
                  onClick={fetchProducts}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                  <span className="ml-3 text-gray-600">Loading products...</span>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12">
                  <Box className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No products yet</p>
                  <p className="text-gray-400 text-sm mt-2">Create your first product to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <h3 className="text-lg font-bold text-gray-800 mb-2">{product.title}</h3>
                      {product.crop_details && (
                        <p className="text-sm text-gray-600 mb-4">{product.crop_details}</p>
                      )}
                      <p className="text-xs text-gray-500">Created: {formatDate(product.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Batches Tab */}
        {activeTab === 'batches' && (
          <div className="space-y-6">
            {/* Create Batch Form */}
            <div className="bg-white rounded-lg shadow-sm p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Create Batch (Harvest)</h2>
              
              <form onSubmit={handleBatchSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="product_id" className="block text-sm font-medium text-gray-700 mb-2">
                      Product <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="product_id"
                      name="product_id"
                      value={batchFormData.product_id}
                      onChange={handleBatchInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all bg-white"
                    >
                      <option value="">Select a product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="initial_quantity" className="block text-sm font-medium text-gray-700 mb-2">
                      Initial Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="initial_quantity"
                      name="initial_quantity"
                      value={batchFormData.initial_quantity}
                      onChange={handleBatchInputChange}
                      required
                      step="0.01"
                      min="0.01"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                      placeholder="e.g., 1000"
                    />
                  </div>

                  <div>
                    <label htmlFor="quantity_unit" className="block text-sm font-medium text-gray-700 mb-2">
                      Unit <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="quantity_unit"
                      name="quantity_unit"
                      value={batchFormData.quantity_unit}
                      onChange={handleBatchInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all bg-white"
                    >
                      <option value="kg">kg</option>
                      <option value="tons">tons</option>
                      <option value="bags">bags</option>
                      <option value="liters">liters</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="harvest_date" className="block text-sm font-medium text-gray-700 mb-2">
                      Harvest Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      id="harvest_date"
                      name="harvest_date"
                      value={batchFormData.harvest_date}
                      onChange={handleBatchInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting || products.length === 0}
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

            {/* Batches List */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">My Batches</h2>
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
                  <p className="text-gray-500 text-lg">No batches yet</p>
                  <p className="text-gray-400 text-sm mt-2">Create your first batch to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {batches.map((batch) => (
                    <div
                      key={batch.id}
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="mb-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-lg font-bold text-gray-800">{batch.product_title || 'Unknown Product'}</h3>
                            <p className="text-sm text-gray-600 font-mono">{batch.batch_code}</p>
                          </div>
                          <Sprout className="w-6 h-6 text-green-600 flex-shrink-0" />
                        </div>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="font-medium">Quantity:</span>
                          <span>{batch.remaining_quantity} / {batch.initial_quantity} {batch.quantity_unit}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>Harvested: {formatDate(batch.harvest_date)}</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-200 space-y-3">
                        <div>{getStatusBadge(batch.status_name)}</div>
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
      </main>

      {/* Event Logging Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Log Event</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedBatch.product_title} - {selectedBatch.batch_code}
                </p>
              </div>
              <button onClick={closeEventModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleEventSubmit} className="p-6 space-y-6">
              <div>
                <label htmlFor="event_type_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Event Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="event_type_name"
                  name="event_type_name"
                  value={eventFormData.event_type_name}
                  onChange={handleEventInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all bg-white"
                >
                  <option value="Fertilizer Applied">Fertilizer Applied</option>
                  <option value="Pesticide Applied">Pesticide Applied</option>
                  <option value="Irrigation">Irrigation</option>
                  <option value="Quality Check">Quality Check</option>
                </select>
              </div>

              <div>
                <label htmlFor="location_coords" className="block text-sm font-medium text-gray-700 mb-2">
                  Location Coordinates (Optional)
                </label>
                <input
                  type="text"
                  id="location_coords"
                  name="location_coords"
                  value={eventFormData.location_coords}
                  onChange={handleEventInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                  placeholder="e.g., 40.7128,-74.0060"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={eventFormData.description}
                  onChange={handleEventInputChange}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                  placeholder="Additional details..."
                />
              </div>

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
