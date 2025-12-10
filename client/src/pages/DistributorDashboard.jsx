import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, Package, ShoppingCart, Loader2, Calendar, Sprout, DollarSign, X, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';
const PRICE_PER_KG = 10;

const DistributorDashboard = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('marketplace');
  const [marketplaceItems, setMarketplaceItems] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [quantityToBuy, setQuantityToBuy] = useState('');
  const [returningBatchId, setReturningBatchId] = useState(null);

  useEffect(() => {
    if (activeTab === 'marketplace') {
      fetchMarketplace();
    } else {
      fetchInventory();
    }
  }, [activeTab, token]);

  // Wallet balance is no longer used (unlimited purchasing / credit)

  const fetchMarketplace = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/distributor/marketplace`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        console.log('Marketplace items:', response.data.data);
        setMarketplaceItems(response.data.data || []);
      } else if (Array.isArray(response.data)) {
        // Fallback if backend ever returns raw array
        setMarketplaceItems(response.data);
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
        setInventoryItems(response.data.data || []);
      } else if (Array.isArray(response.data)) {
        // Fallback if backend returns array directly
        setInventoryItems(response.data);
      } else {
        setInventoryItems([]);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      alert('Failed to load inventory. Please try again.');
      setInventoryItems([]);
    } finally {
      setLoading(false);
    }
  };

  const openBuyModal = (batch) => {
    const availableQuantity =
      Number(
        batch.available_quantity ??
          batch.remaining_quantity ??
          batch.quantity
      ) || 0;
    setSelectedBatch(batch);
    setQuantityToBuy(availableQuantity ? String(availableQuantity) : '');
  };

  const closeBuyModal = () => {
    setSelectedBatch(null);
    setQuantityToBuy('');
  };

  const handleBuy = async () => {
    if (!selectedBatch) return;

    const qty = parseFloat(quantityToBuy);
    if (Number.isNaN(qty) || qty <= 0) {
      alert('Please enter a valid quantity greater than zero.');
      return;
    }

    const availableQuantity = Number(selectedBatch.quantity) || 0;

    if (qty > availableQuantity) {
      alert(`Requested quantity exceeds available supply (${availableQuantity} kg).`);
      return;
    }

    setBuying(true);

    try {
      // Ensure this payload structure: handle both batch_id and id
      const payload = {
        batch_id: selectedBatch.batch_id || selectedBatch.id, // Handle both
        quantity: Number(qty)
      };

      const response = await axios.post(
        `${API_BASE_URL}/distributor/buy`,
        payload,
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

  const handleReturn = async (batchId) => {
    if (!confirm('Are you sure you want to return this batch to the farmer?')) {
      return;
    }

    setReturningBatchId(batchId);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/distributor/return`,
        { batch_id: batchId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('Batch returned successfully!');
        fetchInventory();
      }
    } catch (error) {
      console.error('Error returning batch:', error);
      alert(error.response?.data?.message || 'Failed to return batch. Please try again.');
    } finally {
      setReturningBatchId(null);
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

  const calculateEstimatedCost = (qty, price = PRICE_PER_KG) => {
    const parsedQty = parseFloat(qty);
    const parsedPrice = parseFloat(price);
    const safeQty = Number.isNaN(parsedQty) ? 0 : parsedQty;
    const safePrice = Number.isNaN(parsedPrice) ? 0 : parsedPrice;
    return (safeQty * safePrice).toFixed(2);
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
                {marketplaceItems.map((item) => {
                  const quantity =
                    Number(
                      item.available_quantity ??
                        item.remaining_quantity ??
                        item.quantity
                    ) || 0;
                  const pricePerKg =
                    Number(item.price_per_kg ?? 5) || 5;
                  const farmerName = item.farmer_name || 'Unknown';
                  const title =
                    item.product_name ||
                    item.product_title ||
                    item.crop_name ||
                    'Unknown Crop';

                  return (
                      <div
                      key={item.batch_id || item.id}
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="mb-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-lg font-bold text-gray-800">{title}</h3>
                            <p className="text-sm text-gray-600">{item.variety || ''}</p>
                          </div>
                          <Sprout className="w-6 h-6 text-green-600 flex-shrink-0" />
                        </div>
                        <div className="text-xs text-gray-500">
                          Farmer:{' '}
                          <span className="font-medium text-gray-700">{farmerName}</span>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>Harvested: {formatDate(item.harvest_date)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="font-medium">Available:</span>
                          <span>{quantity || 0} kg</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="font-medium">Price/kg:</span>
                          <span>${pricePerKg.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Estimated Cost:</span>
                          <span className="text-lg font-bold text-blue-600">
                            ${calculateEstimatedCost(quantity, pricePerKg)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          ({quantity} kg @ ${pricePerKg.toFixed(2)}/kg)
                        </p>
                      </div>

                      <div className="pt-4 border-t border-gray-200">
                        <button
                          onClick={() => openBuyModal(item)}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                        >
                          <DollarSign className="w-4 h-4" />
                          Buy Now
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
                <p className="text-gray-500 text-lg">No items in inventory</p>
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
                          <h3 className="text-lg font-bold text-gray-800">{item.product_name || 'Unknown Product'}</h3>
                          <p className="text-sm text-gray-600">{item.batch_code || ''}</p>
                        </div>
                        <Sprout className="w-6 h-6 text-green-600 flex-shrink-0" />
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="font-medium">Quantity:</span>
                        <span>{item.remaining_quantity || 0} kg</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>Harvested: {(() => {
                          // Safe Date Logic
                          const dateStr = item.harvest_date || item.created_at;
                          const displayDate = dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A';
                          return displayDate;
                        })()}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          {item.status_name ? item.status_name.replace(/_/g, ' ') : 'Unknown'}
                        </span>
                        {(item.status_name === 'In Warehouse' || item.status_name === 'Harvested') && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            Listed for Sale
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleReturn(item.id)}
                        disabled={returningBatchId === item.id}
                        className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {returningBatchId === item.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Returning...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-4 h-4" />
                            Return to Farmer
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {selectedBatch &&
        (() => {
          const pricePerKg = Number(selectedBatch.price_per_kg) || PRICE_PER_KG;
          const availableQuantity = Number(selectedBatch.quantity) || 0;
          const totalCost = calculateEstimatedCost(quantityToBuy, pricePerKg);
          // Unlimited purchasing: no balance / credit restriction

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Purchase Crop</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedBatch.crop_name} - {selectedBatch.variety}
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
                      <span className="font-medium text-gray-800">
                        {selectedBatch.farmer_name || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Price per kg:</span>
                      <span className="font-medium text-gray-800">${pricePerKg.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Available Quantity:</span>
                      <span className="font-medium text-gray-800">{availableQuantity} kg</span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="quantityToBuy" className="block text-sm font-medium text-gray-700 mb-2">
                      Quantity to Buy (kg) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="quantityToBuy"
                      value={quantityToBuy}
                      onChange={(e) => setQuantityToBuy(e.target.value)}
                      required
                      min="0.01"
                      step="0.01"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      placeholder="Enter quantity in kg"
                    />
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Total Cost:</span>
                      <span className="text-2xl font-bold text-blue-600">${totalCost}</span>
                    </div>
                  </div>
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
                    disabled={buying || !quantityToBuy}
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
          );
        })()}
    </div>
  );
};

export default DistributorDashboard;
 