import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Store, Loader2, Calendar, Package, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const ShopkeeperDashboard = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/shop/inventory`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setInventory(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching shop inventory:', error);
      alert('Failed to load store inventory. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSell = async (batchId) => {
    const input = window.prompt('Enter final sale price (USD):', '10000');
    if (input === null) {
      return;
    }

    const finalPrice = parseFloat(input);
    if (Number.isNaN(finalPrice) || finalPrice <= 0) {
      alert('Please enter a valid price greater than zero.');
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/shop/sell`,
        { batch_id: batchId, final_price: finalPrice },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('Sale recorded successfully!');
        fetchInventory();
      }
    } catch (error) {
      console.error('Error selling batch:', error);
      alert(error.response?.data?.message || 'Failed to record sale. Please try again.');
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
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Store className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Shopkeeper Dashboard</h1>
              <p className="text-sm text-gray-500">
                Welcome, {user?.username}{' '}
                <span className="font-semibold text-purple-600">
                  | Wallet: ${user?.wallet_balance?.toFixed(2)}
                </span>
              </p>
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
            <h2 className="text-2xl font-bold text-gray-800">Store Inventory</h2>
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
          ) : inventory.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No items in store inventory</p>
              <p className="text-gray-400 text-sm mt-2">Await deliveries from transporter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inventory.map((item) => (
                <div
                  key={item.batch_id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="mb-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">{item.crop_name}</h3>
                        <p className="text-sm text-gray-600">{item.variety}</p>
                      </div>
                      <Store className="w-6 h-6 text-purple-600 flex-shrink-0" />
                    </div>
                    <div className="text-xs text-gray-500">
                      Farmer:{' '}
                      <span className="font-medium text-gray-700">{item.farmer_username}</span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>Harvested: {formatDate(item.harvest_date)}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleSell(item.batch_id)}
                      className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <DollarSign className="w-4 h-4" />
                      Sell to Consumer
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

export default ShopkeeperDashboard;





