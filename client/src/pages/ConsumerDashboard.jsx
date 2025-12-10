import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, ShoppingCart, Package, Loader2, Calendar, MapPin, Sprout, Factory, Truck, Store, ChevronDown, ChevronUp, X, Database, Link } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const ConsumerDashboard = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('shop');
  const [marketplace, setMarketplace] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [buyModal, setBuyModal] = useState(null);
  const [buyQuantity, setBuyQuantity] = useState('');
  const [buying, setBuying] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState({});
  const [expandedBlockchain, setExpandedBlockchain] = useState({});
  const [blockchainData, setBlockchainData] = useState({});
  const [blockchainLoading, setBlockchainLoading] = useState({});

  useEffect(() => {
    if (activeTab === 'shop') {
      fetchMarketplace();
    } else if (activeTab === 'purchases') {
      fetchMyOrders();
    }
  }, [activeTab]);

  const fetchMarketplace = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE_URL}/consumer/marketplace`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setMarketplace(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching marketplace:', err);
      setError(err.response?.data?.message || 'Failed to fetch marketplace');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE_URL}/consumer/my-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setMyOrders(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err.response?.data?.message || 'Failed to fetch your purchases');
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async () => {
    if (!buyModal || !buyQuantity) {
      setError('Please enter a quantity');
      return;
    }

    const quantity = parseFloat(buyQuantity);
    if (Number.isNaN(quantity) || quantity <= 0) {
      setError('Please enter a valid quantity');
      return;
    }

    if (quantity > buyModal.available_quantity) {
      setError(`Insufficient quantity. Available: ${buyModal.available_quantity} ${buyModal.quantity_unit}`);
      return;
    }

    setBuying(true);
    setError('');

    try {
      const response = await axios.post(
        `${API_BASE_URL}/consumer/buy`,
        {
          batch_id: buyModal.id,
          quantity: quantity,
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setBuyModal(null);
        setBuyQuantity('');
        // Refresh marketplace
        await fetchMarketplace();
        // Switch to purchases tab and refresh
        setActiveTab('purchases');
        await fetchMyOrders();
        alert('Purchase successful!');
      }
    } catch (err) {
      console.error('Error buying:', err);
      setError(err.response?.data?.message || 'Failed to process purchase');
    } finally {
      setBuying(false);
    }
  };

  const toggleHistory = (orderId) => {
    setExpandedHistory(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const toggleBlockchain = async (batchCode, batchId) => {
    const isExpanding = !expandedBlockchain[batchId];
    
    setExpandedBlockchain(prev => ({
      ...prev,
      [batchId]: isExpanding
    }));

    // Fetch blockchain data if expanding and not already loaded
    if (isExpanding && !blockchainData[batchCode]) {
      setBlockchainLoading(prev => ({ ...prev, [batchId]: true }));
      
      try {
        const response = await axios.get(
          `${API_BASE_URL}/consumer/blockchain/${batchCode}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data.success) {
          setBlockchainData(prev => ({
            ...prev,
            [batchCode]: response.data.data.transactions || []
          }));
        }
      } catch (err) {
        console.error('Error fetching blockchain:', err);
        setError('Failed to load blockchain data');
      } finally {
        setBlockchainLoading(prev => ({ ...prev, [batchId]: false }));
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('shop')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                activeTab === 'shop'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <ShoppingCart className="w-5 h-5 inline mr-2" />
              Shop
            </button>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                activeTab === 'purchases'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Package className="w-5 h-5 inline mr-2" />
              My Purchases
            </button>
          </div>
        </div>

          {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

        {/* Shop Tab */}
        {activeTab === 'shop' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Available Products</h2>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : marketplace.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <p className="text-gray-500">No products available at the moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {marketplace.map((item) => (
                  <div key={item.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">{item.product.title}</h3>
                    <p className="text-sm text-gray-600 mb-4">{item.product.crop_details || 'Fresh produce'}</p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Sold by:</span>
                        <span className="font-medium">{item.shopkeeper.name || item.shopkeeper.username}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Available:</span>
                        <span className="font-medium">{item.available_quantity} {item.quantity_unit}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Price:</span>
                        <span className="font-bold text-indigo-600">${item.price_per_unit.toFixed(2)} / {item.quantity_unit}</span>
                      </div>
        </div>

                    <button
                      onClick={() => {
                        setBuyModal(item);
                        setBuyQuantity('');
                        setError('');
                      }}
                      className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                    >
                      Buy
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Purchases Tab */}
        {activeTab === 'purchases' && (
                <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">My Purchases</h2>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            ) : myOrders.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <p className="text-gray-500">You haven't purchased anything yet.</p>
                <button
                  onClick={() => setActiveTab('shop')}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Browse Shop
                </button>
                </div>
            ) : (
              <div className="space-y-4">
                {myOrders.map((order) => (
                  <div key={order.id} className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-800 mb-2">{order.product.title}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                            <span className="text-gray-600">Batch Code:</span>
                            <p className="font-mono font-semibold">{order.batch_code}</p>
                </div>
                <div>
                            <span className="text-gray-600">Quantity:</span>
                            <p className="font-semibold">{order.quantity} {order.quantity_unit}</p>
                </div>
                <div>
                            <span className="text-gray-600">Status:</span>
                            <p className="font-semibold">{order.status}</p>
                </div>
                <div>
                            <span className="text-gray-600">Purchased:</span>
                            <p className="font-semibold">{formatDate(order.created_at)}</p>
                </div>
              </div>
                      </div>
                      <div className="ml-4 flex gap-2">
                        <button
                          onClick={() => toggleHistory(order.id)}
                          className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors flex items-center gap-2"
                        >
                          {expandedHistory[order.id] ? (
                            <>
                              <ChevronUp className="w-4 h-4" />
                              Hide History
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              View History
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => toggleBlockchain(order.batch_code, order.id)}
                          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2"
                        >
                          {expandedBlockchain[order.id] ? (
                            <>
                              <ChevronUp className="w-4 h-4" />
                              Hide Blockchain
                            </>
                          ) : (
                            <>
                              <Database className="w-4 h-4" />
                              View Blockchain
                            </>
                          )}
                        </button>
                      </div>
            </div>

                    {/* Expanded History Timeline */}
                    {expandedHistory[order.id] && order.lifecycle_stages && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <h4 className="text-lg font-bold text-gray-800 mb-4">Product Journey</h4>
                        <div className="space-y-4">
                          {/* Farmer Stage */}
                          {order.lifecycle_stages.farmer && (
                            <div className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                  <Sprout className="w-5 h-5 text-green-600" />
                                </div>
                                {order.lifecycle_stages.distributor && (
                                  <div className="w-0.5 h-8 bg-gray-300 mt-2"></div>
                                )}
                              </div>
                              <div className="flex-1 pb-4">
                                <div className="bg-green-50 rounded-lg p-4">
                                  <h5 className="font-semibold text-gray-800 mb-1">🌱 Origin: Farm</h5>
                                  <p className="text-sm text-gray-700">
                                    <span className="font-medium">Farmer:</span> {order.lifecycle_stages.farmer.name}
                </p>
                                  {order.lifecycle_stages.farmer.harvest_date && (
                                    <p className="text-sm text-gray-600 mt-1">
                                      <Calendar className="w-4 h-4 inline mr-1" />
                                      Harvested: {formatDate(order.lifecycle_stages.farmer.harvest_date)}
                                    </p>
                                  )}
                                </div>
                              </div>
              </div>
            )}

                          {/* Distributor Stage */}
                          {order.lifecycle_stages.distributor && (
                            <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                  <Factory className="w-5 h-5 text-blue-600" />
                                </div>
                                {order.lifecycle_stages.transporter && (
                                  <div className="w-0.5 h-8 bg-gray-300 mt-2"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                                <div className="bg-blue-50 rounded-lg p-4">
                                  <h5 className="font-semibold text-gray-800 mb-1">🏭 Processing: Distribution</h5>
                                  <p className="text-sm text-gray-700">
                                    <span className="font-medium">Distributor:</span> {order.lifecycle_stages.distributor.name}
                                  </p>
                                  {order.lifecycle_stages.distributor.created_at && (
                                    <p className="text-sm text-gray-600 mt-1">
                                      <Calendar className="w-4 h-4 inline mr-1" />
                                      Processed: {formatDate(order.lifecycle_stages.distributor.created_at)}
                              </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Transporter Stage */}
                          {order.lifecycle_stages.transporter && (
                            <div className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                                  <Truck className="w-5 h-5 text-orange-600" />
                                </div>
                                {order.lifecycle_stages.retailer && (
                                  <div className="w-0.5 h-8 bg-gray-300 mt-2"></div>
                                )}
                              </div>
                              <div className="flex-1 pb-4">
                                <div className="bg-orange-50 rounded-lg p-4">
                                  <h5 className="font-semibold text-gray-800 mb-1">🚚 Logistics: Transportation</h5>
                                  <p className="text-sm text-gray-700">
                                    <span className="font-medium">Transporter:</span> {order.lifecycle_stages.transporter.name}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Retailer Stage */}
                          {order.lifecycle_stages.retailer && (
                            <div className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                  <Store className="w-5 h-5 text-purple-600" />
                                </div>
                              </div>
                              <div className="flex-1 pb-4">
                                <div className="bg-purple-50 rounded-lg p-4">
                                  <h5 className="font-semibold text-gray-800 mb-1">🏪 Retail: Shop</h5>
                                  <p className="text-sm text-gray-700">
                                    <span className="font-medium">Retailer:</span> {order.lifecycle_stages.retailer.name}
                                  </p>
                                  {order.lifecycle_stages.retailer.created_at && (
                                    <p className="text-sm text-gray-600 mt-1">
                                      <Calendar className="w-4 h-4 inline mr-1" />
                                      Sold: {formatDate(order.lifecycle_stages.retailer.created_at)}
                                    </p>
                              )}
                            </div>
                          </div>
                            </div>
                          )}

                          {/* Fallback if no lifecycle stages */}
                          {!order.lifecycle_stages.farmer && !order.lifecycle_stages.distributor && 
                           !order.lifecycle_stages.transporter && !order.lifecycle_stages.retailer && (
                            <div className="text-center py-4 text-gray-500">
                              <p>History information not available for this item.</p>
                            </div>
                          )}
                        </div>
                      </div>
                )}

                    {/* Expanded Blockchain View */}
                    {expandedBlockchain[order.id] && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <div className="flex items-center gap-2 mb-4">
                          <Database className="w-6 h-6 text-blue-600" />
                          <h4 className="text-lg font-bold text-gray-800">Blockchain Trail</h4>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            Batch: {order.batch_code}
                          </span>
                        </div>
                        
                        {blockchainLoading[order.id] ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                            <span className="text-gray-600">Loading blockchain data...</span>
                          </div>
                        ) : blockchainData[order.batch_code] && blockchainData[order.batch_code].length > 0 ? (
                          <div className="space-y-3">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                              <p className="text-blue-900">
                                <strong>Total Blockchain Records:</strong> {blockchainData[order.batch_code].length}
                              </p>
                              <p className="text-blue-700 text-xs mt-1">
                                Immutable records stored on decentralized blockchain
                              </p>
                            </div>
                            
                            {blockchainData[order.batch_code].map((tx, idx) => (
                              <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Link className="w-4 h-4 text-blue-600" />
                                      <span className="font-semibold text-gray-900">{tx.event_type}</span>
                                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                        Block #{tx.block_index}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 font-mono mb-2">
                                      Block Hash: {tx.block_hash?.substring(0, 20)}...
                                    </p>
                                    <p className="text-xs text-gray-600">
                                      <Calendar className="w-3 h-3 inline mr-1" />
                                      {new Date(tx.block_timestamp).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                  <p className="text-xs font-medium text-gray-600 mb-2">Transaction Data:</p>
                                  <div className="bg-gray-50 rounded p-2 text-xs">
                                    <pre className="whitespace-pre-wrap text-gray-700 overflow-x-auto">
                                      {(() => {
                                        try {
                                          const parsed = typeof tx.data === 'string' ? JSON.parse(tx.data) : tx.data;
                                          return JSON.stringify(parsed, null, 2);
                                        } catch (e) {
                                          return tx.data || 'No data';
                                        }
                                      })()}
                                    </pre>
                                  </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-3 text-xs">
                                  <div>
                                    <p className="text-gray-500 mb-1">Previous Block:</p>
                                    <p className="font-mono text-gray-700 break-all">
                                      {tx.previous_hash?.substring(0, 16)}...
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500 mb-1">Batch ID:</p>
                                    <p className="font-semibold text-gray-700">{tx.batch_id}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                            
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <p className="text-green-900 font-medium">
                                  ✓ All records verified and cryptographically secured
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-gray-50 rounded-lg">
                            <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No blockchain records found for this batch</p>
                            <p className="text-xs text-gray-400 mt-1">
                              Blockchain data may not be available yet
                            </p>
                          </div>
                        )}
                      </div>
                    )}
              </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Buy Modal */}
        {buyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">Purchase {buyModal.product.title}</h3>
                <button
                  onClick={() => {
                    setBuyModal(null);
                    setBuyQuantity('');
                    setError('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Sold by:</p>
                  <p className="font-medium">{buyModal.shopkeeper.name || buyModal.shopkeeper.username}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Available:</p>
                  <p className="font-medium">{buyModal.available_quantity} {buyModal.quantity_unit}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Price:</p>
                  <p className="font-bold text-indigo-600">${buyModal.price_per_unit.toFixed(2)} / {buyModal.quantity_unit}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity ({buyModal.quantity_unit})
                  </label>
                  <input
                    type="number"
                    value={buyQuantity}
                    onChange={(e) => {
                      setBuyQuantity(e.target.value);
                      setError('');
                    }}
                    min="0.01"
                    max={buyModal.available_quantity}
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder={`Enter quantity (max: ${buyModal.available_quantity})`}
                  />
                </div>
                {buyQuantity && !isNaN(parseFloat(buyQuantity)) && parseFloat(buyQuantity) > 0 && (
                  <div className="bg-indigo-50 rounded-lg p-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-semibold">
                        ${(parseFloat(buyQuantity) * buyModal.price_per_unit).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-indigo-600">
                      <span>Total:</span>
                      <span>${(parseFloat(buyQuantity) * buyModal.price_per_unit).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setBuyModal(null);
                    setBuyQuantity('');
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBuy}
                  disabled={buying || !buyQuantity || parseFloat(buyQuantity) <= 0}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {buying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Confirm Purchase'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ConsumerDashboard;











