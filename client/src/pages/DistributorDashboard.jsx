import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, Package, ShoppingCart, Loader2, Calendar, Sprout, DollarSign, X, Scissors, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const DistributorDashboard = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('marketplace');
  const [marketplaceItems, setMarketplaceItems] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [splitBatch, setSplitBatch] = useState(null);
  const [splits, setSplits] = useState([{ quantity: '', quantity_unit: 'kg' }]);

  useEffect(() => {
    if (activeTab === 'marketplace') {
      fetchMarketplace();
    } else {
      fetchInventory();
    }
  }, [activeTab, token]);

  const fetchMarketplace = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/distributor/marketplace`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setMarketplaceItems(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching marketplace:', error);
      alert('Failed to load marketplace. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/distributor/inventory`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setInventoryItems(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      alert('Failed to load inventory. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openBuyModal = (batch) => {
    setSelectedBatch(batch);
  };

  const closeBuyModal = () => {
    setSelectedBatch(null);
  };

  const handleBuy = async () => {
    if (!selectedBatch) return;

    setBuying(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/distributor/buy`,
        { batch_id: selectedBatch.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('Purchase successful!');
        closeBuyModal();
        fetchMarketplace();
        setActiveTab('inventory');
        fetchInventory();
      }
    } catch (error) {
      console.error('Error buying batch:', error);
      alert(error.response?.data?.message || 'Failed to complete purchase. Please try again.');
    } finally {
      setBuying(false);
    }
  };

  const openSplitModal = (batch) => {
    setSplitBatch(batch);
    setSplits([{ quantity: '', quantity_unit: batch.quantity_unit || 'kg' }]);
  };

  const closeSplitModal = () => {
    setSplitBatch(null);
    setSplits([{ quantity: '', quantity_unit: 'kg' }]);
  };

  const addSplitRow = () => {
    setSplits([...splits, { quantity: '', quantity_unit: splitBatch?.quantity_unit || 'kg' }]);
  };

  const removeSplitRow = (index) => {
    if (splits.length > 1) {
      setSplits(splits.filter((_, i) => i !== index));
    }
  };

  const updateSplit = (index, field, value) => {
    const newSplits = [...splits];
    newSplits[index][field] = value;
    setSplits(newSplits);
  };

  const handleSplit = async () => {
    if (!splitBatch) return;

    // Validate splits
    const totalQuantity = splits.reduce((sum, split) => {
      return sum + (parseFloat(split.quantity) || 0);
    }, 0);

    if (totalQuantity <= 0) {
      alert('Please enter at least one valid split quantity.');
      return;
    }

    const availableQty = parseFloat(splitBatch.remaining_quantity) || 0;
    if (totalQuantity > availableQty) {
      alert(`Total split quantity (${totalQuantity}) exceeds available quantity (${availableQty}).`);
      return;
    }

    setSplitting(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/distributor/split-batch`,
        {
          parent_batch_id: splitBatch.id,
          splits: splits.map(s => ({
            quantity: parseFloat(s.quantity),
            quantity_unit: s.quantity_unit
          }))
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert(`Batch split successfully! Created ${response.data.data.child_batches.length} child batches.`);
        closeSplitModal();
        fetchInventory();
      }
    } catch (error) {
      console.error('Error splitting batch:', error);
      alert(error.response?.data?.message || 'Failed to split batch. Please try again.');
    } finally {
      setSplitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Distributor Dashboard</h1>
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
                onClick={() => setActiveTab('marketplace')}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'marketplace'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                Marketplace
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'inventory'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Package className="w-5 h-5" />
                My Inventory
              </button>
            </nav>
          </div>
        </div>

        {activeTab === 'marketplace' ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Available Crops</h2>
              <button
                onClick={fetchMarketplace}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-3 text-gray-600">Loading marketplace...</span>
              </div>
            ) : marketplaceItems.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No crops available in marketplace</p>
                <p className="text-gray-400 text-sm mt-2">Check back later for harvested crops</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {marketplaceItems.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="mb-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">{item.product_title || 'Unknown Product'}</h3>
                          <p className="text-sm text-gray-600 font-mono">{item.batch_code}</p>
                        </div>
                        <Sprout className="w-6 h-6 text-green-600 flex-shrink-0" />
                      </div>
                      <div className="text-xs text-gray-500">
                        Farmer: <span className="font-medium text-gray-700">{item.owner_username || 'Unknown'}</span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>Harvested: {formatDate(item.harvest_date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="font-medium">Available:</span>
                        <span>{item.remaining_quantity || 0} {item.quantity_unit || 'kg'}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                      <button
                        onClick={() => openBuyModal(item)}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <DollarSign className="w-4 h-4" />
                        Buy Batch
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">My Inventory</h2>
              <button
                onClick={fetchInventory}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-3 text-gray-600">Loading inventory...</span>
              </div>
            ) : inventoryItems.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No inventory yet</p>
                <p className="text-gray-400 text-sm mt-2">Purchase crops from the marketplace to get started</p>
                <button
                  onClick={() => setActiveTab('marketplace')}
                  className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Browse Marketplace
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {inventoryItems.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="mb-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">{item.product_title || 'Unknown Product'}</h3>
                          <p className="text-sm text-gray-600 font-mono">{item.batch_code}</p>
                        </div>
                        <Sprout className="w-6 h-6 text-green-600 flex-shrink-0" />
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="font-medium">Quantity:</span>
                        <span>{item.remaining_quantity} / {item.initial_quantity} {item.quantity_unit}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>Harvested: {formatDate(item.harvest_date)}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200 space-y-3">
                      <div>{getStatusBadge(item.status_name)}</div>
                      {item.remaining_quantity > 0 && (
                        <button
                          onClick={() => openSplitModal(item)}
                          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                        >
                          <Scissors className="w-4 h-4" />
                          Split Batch
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Buy Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Purchase Batch</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedBatch.product_title} - {selectedBatch.batch_code}
                </p>
              </div>
              <button onClick={closeBuyModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Farmer:</span>
                  <span className="font-medium text-gray-800">{selectedBatch.owner_username || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Available Quantity:</span>
                  <span className="font-medium text-gray-800">
                    {selectedBatch.remaining_quantity} {selectedBatch.quantity_unit}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-600">
                This will purchase the entire batch and transfer ownership to you.
              </p>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-4">
              <button
                onClick={closeBuyModal}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                disabled={buying}
              >
                Cancel
              </button>
              <button
                onClick={handleBuy}
                disabled={buying}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {buying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <DollarSign className="w-5 h-5" />
                    Confirm Purchase
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split Modal */}
      {splitBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Split Batch</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {splitBatch.product_title} - {splitBatch.batch_code}
                  <br />
                  Available: {splitBatch.remaining_quantity} {splitBatch.quantity_unit}
                </p>
              </div>
              <button onClick={closeSplitModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-4">
                {splits.map((split, index) => (
                  <div key={index} className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantity {index + 1}
                      </label>
                      <input
                        type="number"
                        value={split.quantity}
                        onChange={(e) => updateSplit(index, 'quantity', e.target.value)}
                        step="0.01"
                        min="0.01"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        placeholder="Enter quantity"
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                      <select
                        value={split.quantity_unit}
                        onChange={(e) => updateSplit(index, 'quantity_unit', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
                      >
                        <option value="kg">kg</option>
                        <option value="tons">tons</option>
                        <option value="bags">bags</option>
                        <option value="liters">liters</option>
                      </select>
                    </div>
                    {splits.length > 1 && (
                      <button
                        onClick={() => removeSplitRow(index)}
                        className="px-4 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={addSplitRow}
                className="w-full px-4 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-green-500 hover:text-green-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Another Split
              </button>

              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Total Split Quantity:</span>
                  <span className="text-lg font-bold text-blue-600">
                    {splits.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0).toFixed(2)} {splitBatch?.quantity_unit}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Available: {splitBatch?.remaining_quantity} {splitBatch?.quantity_unit}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-4">
              <button
                onClick={closeSplitModal}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                disabled={splitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSplit}
                disabled={splitting}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {splitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Splitting...
                  </>
                ) : (
                  <>
                    <Scissors className="w-5 h-5" />
                    Split Batch
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributorDashboard;
