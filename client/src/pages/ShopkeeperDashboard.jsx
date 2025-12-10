import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Store, Package, ShoppingCart, Loader2, Calendar, Sprout, DollarSign, X, Trash2, Plus, Minus, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const ShopkeeperDashboard = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('marketplace');
  const [marketplaceItems, setMarketplaceItems] = useState([]);
  const [cart, setCart] = useState([]); // [{batch_id, batch, quantity, unit_price}]
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    if (activeTab === 'marketplace') {
      fetchMarketplace();
    } else if (activeTab === 'inventory') {
      fetchInventory();
    }
  }, [activeTab, token]);

  const fetchMarketplace = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/commerce/marketplace`, {
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
      // Get batches owned by retailer (status "In Shop")
      const response = await axios.get(`${API_BASE_URL}/commerce/inventory`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setInventoryItems(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      // Fallback: Try using Batch.findByOwnerId endpoint if available
      try {
        const fallbackResponse = await axios.get(`${API_BASE_URL}/distributor/inventory`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (fallbackResponse.data.success) {
          // Filter for "In Shop" status
          const inShopBatches = fallbackResponse.data.data.filter(
            batch => batch.status_name === 'In Shop'
          );
          setInventoryItems(inShopBatches);
        }
      } catch (fallbackError) {
        console.error('Fallback inventory fetch failed:', fallbackError);
        alert('Failed to load inventory. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (batch) => {
    const existingItem = cart.find(item => item.batch_id === batch.id);
    
    if (existingItem) {
      // Update quantity if already in cart
      setCart(cart.map(item =>
        item.batch_id === batch.id
          ? { ...item, quantity: Math.min(item.quantity + 1, batch.remaining_quantity) }
          : item
      ));
    } else {
      // Add new item to cart with default quantity 1
      // Use calculated_price from backend (dynamic pricing based on seller role)
      const unitPrice = batch.calculated_price || 10.00;
      setCart([...cart, {
        batch_id: batch.id,
        batch: batch,
        quantity: 1,
        unit_price: unitPrice
      }]);
    }
  };

  const removeFromCart = (batchId) => {
    setCart(cart.filter(item => item.batch_id !== batchId));
  };

  const updateCartQuantity = (batchId, newQuantity) => {
    const item = cart.find(item => item.batch_id === batchId);
    if (!item) return;

    const maxQuantity = parseFloat(item.batch.remaining_quantity) || 0;
    const quantity = Math.max(1, Math.min(newQuantity, maxQuantity));

    setCart(cart.map(item =>
      item.batch_id === batchId
        ? { ...item, quantity }
        : item
    ));
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.quantity * item.unit_price), 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty. Add items from the marketplace.');
      return;
    }

    setCheckingOut(true);
    try {
      // Prepare items for checkout
      const items = cart.map(item => ({
        batch_id: item.batch_id,
        quantity: item.quantity,
        unit_price: item.unit_price
      }));

      const response = await axios.post(
        `${API_BASE_URL}/commerce/orders`,
        { items },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert(`Order placed successfully! Order #${response.data.data.order.order_number}`);
        setCart([]); // Clear cart
        setActiveTab('inventory'); // Switch to inventory tab
        fetchInventory(); // Refresh inventory
        fetchMarketplace(); // Refresh marketplace to update quantities
      } else {
        alert(response.data.message || 'Checkout failed. Please try again.');
      }
    } catch (error) {
      console.error('Error during checkout:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to complete checkout. Please try again.';
      alert(errorMessage);
    } finally {
      setCheckingOut(false);
    }
  };

  const handleReturn = async (batch) => {
    if (!batch) return;

    const confirmReturn = window.confirm(
      `Are you sure you want to return this batch to the distributor?\n\n` +
      `Batch: ${batch.batch_code}\n` +
      `Quantity: ${batch.remaining_quantity} ${batch.quantity_unit || 'kg'}\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmReturn) return;

    setReturning(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/commerce/return`,
        { batch_id: batch.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('Batch returned successfully! Quantity has been restored to the distributor.');
        fetchInventory();
      } else {
        alert(response.data.message || 'Return failed. Please try again.');
      }
    } catch (error) {
      console.error('Error returning batch:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to return batch. Please try again.';
      alert(errorMessage);
    } finally {
      setReturning(false);
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
      'In Transit': 'bg-orange-100 text-orange-800',
      'In Warehouse': 'bg-blue-100 text-blue-800',
      'In Shop': 'bg-green-100 text-green-800',
      'Pending Delivery': 'bg-orange-100 text-orange-800',
      'Sold': 'bg-gray-100 text-gray-800',
      'Processing': 'bg-orange-100 text-orange-800',
      'Returned': 'bg-red-100 text-red-800'
    };

    // Determine badge text and icon
    let badgeText = status;
    let badgeIcon = null;
    
    if (status === 'In Shop') {
      badgeText = 'Ready to Sell';
      badgeIcon = '✓';
    } else if (status === 'Pending Delivery' || status === 'In Transit') {
      badgeText = 'On the Way';
      badgeIcon = '🚚';
    }

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {badgeIcon && <span>{badgeIcon}</span>}
        {badgeText}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Store className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Retailer Dashboard</h1>
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
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                Marketplace
                {cart.length > 0 && (
                  <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {cart.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('cart')}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'cart'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Package className="w-5 h-5" />
                My Cart
                {cart.length > 0 && (
                  <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {cart.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'inventory'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Store className="w-5 h-5" />
                My Inventory
              </button>
            </nav>
          </div>
        </div>

        {activeTab === 'marketplace' ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Available Products</h2>
              <button
                onClick={fetchMarketplace}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                <span className="ml-3 text-gray-600">Loading marketplace...</span>
              </div>
            ) : marketplaceItems.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No products available in marketplace</p>
                <p className="text-gray-400 text-sm mt-2">Check back later for distributor inventory</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {marketplaceItems.map((item) => {
                  const inCart = cart.find(cartItem => cartItem.batch_id === item.id);
                  return (
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
                          {item.seller_role ? (
                            <>
                              <span className="capitalize">{item.seller_role.toLowerCase()}</span>: <span className="font-medium text-gray-700">{item.owner_username || item.owner_name || 'Unknown'}</span>
                            </>
                          ) : (
                            <>Seller: <span className="font-medium text-gray-700">{item.owner_username || 'Unknown'}</span></>
                          )}
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
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="font-medium">Price:</span>
                          <span className="text-purple-600 font-bold">
                            ${(item.calculated_price || 10.00).toFixed(2)} / {item.quantity_unit || 'kg'}
                          </span>
                          {item.seller_role?.toUpperCase() === 'FARMER' && (
                            <span className="text-xs text-orange-600 font-semibold">(Premium)</span>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-200">
                        {inCart ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateCartQuantity(item.id, inCart.quantity - 1)}
                              className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="flex-1 text-center text-sm font-medium">
                              {inCart.quantity} in cart
                            </span>
                            <button
                              onClick={() => updateCartQuantity(item.id, inCart.quantity + 1)}
                              disabled={inCart.quantity >= item.remaining_quantity}
                              className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(item)}
                            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                          >
                            <ShoppingCart className="w-4 h-4" />
                            Add to Cart
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'cart' ? (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Shopping Cart</h2>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Your cart is empty</p>
                <p className="text-gray-400 text-sm mt-2">Add items from the marketplace to get started</p>
                <button
                  onClick={() => setActiveTab('marketplace')}
                  className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Browse Marketplace
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div
                    key={item.batch_id}
                    className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800">{item.batch.product_title || 'Unknown Product'}</h3>
                      <p className="text-sm text-gray-600">{item.batch.batch_code}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {item.quantity} {item.batch.quantity_unit || 'kg'} × ${item.unit_price.toFixed(2)} = ${(item.quantity * item.unit_price).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateCartQuantity(item.batch_id, item.quantity - 1)}
                          className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-12 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQuantity(item.batch_id, item.quantity + 1)}
                          disabled={item.quantity >= item.batch.remaining_quantity}
                          className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.batch_id)}
                        className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="border-t border-gray-200 pt-4 mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold text-gray-800">Total:</span>
                    <span className="text-2xl font-bold text-purple-600">${getCartTotal().toFixed(2)}</span>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={checkingOut}
                    className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checkingOut ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <DollarSign className="w-5 h-5" />
                        Checkout
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">My Inventory</h2>
              <button
                onClick={fetchInventory}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                <span className="ml-3 text-gray-600">Loading inventory...</span>
              </div>
            ) : inventoryItems.length === 0 ? (
              <div className="text-center py-12">
                <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No inventory yet</p>
                <p className="text-gray-400 text-sm mt-2">Purchase products from the marketplace to stock your shop</p>
                <button
                  onClick={() => setActiveTab('marketplace')}
                  className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
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
                      {/* Only show return button for items that have arrived (In Shop status) */}
                      {item.remaining_quantity > 0 && 
                       item.status_name === 'In Shop' && 
                       item.status_name !== 'Returned' && (
                        <button
                          onClick={() => handleReturn(item)}
                          disabled={returning}
                          className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Return to Distributor
                        </button>
                      )}
                      {/* Show message for items not yet arrived */}
                      {(item.status_name === 'Pending Delivery' || item.status_name === 'In Transit') && (
                        <p className="text-xs text-gray-500 text-center italic">
                          Item is in transit. Return available after delivery.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ShopkeeperDashboard;
