import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, CheckCircle, XCircle, Loader2, Shield, Database, Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const AdminDashboard = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();

  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [blockchain, setBlockchain] = useState([]);
  const [blockchainLoading, setBlockchainLoading] = useState(false);
  const [showBlockchain, setShowBlockchain] = useState(false);
  const [blockchainView, setBlockchainView] = useState('all'); // 'all' or 'batch'
  const [searchBatchId, setSearchBatchId] = useState('');
  const [filteredBlockchain, setFilteredBlockchain] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [showBatchList, setShowBatchList] = useState(false);

  useEffect(() => {
    fetchPendingUsers();
    fetchBlockchainData();
    fetchAllBatches();
  }, [token]);

  const fetchAllBatches = async () => {
    setBatchesLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/blockchain`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        // Extract unique batch IDs from blockchain
        const batches = new Set();
        response.data.data.blocks?.forEach(block => {
          block.transactions?.forEach(tx => {
            if (tx.batch_id && tx.batch_id !== 'SYSTEM_LOG') {
              batches.add(tx.batch_id);
            }
          });
        });
        setAllBatches(Array.from(batches).sort());
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setBatchesLoading(false);
    }
  };

  const fetchBlockchainData = async () => {
    setBlockchainLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/blockchain`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setBlockchain(response.data.data.blocks || []);
        setFilteredBlockchain(response.data.data.blocks || []);
      }
    } catch (error) {
      console.error('Error fetching blockchain:', error);
    } finally {
      setBlockchainLoading(false);
    }
  };

  const handleBatchSearch = () => {
    if (!searchBatchId.trim()) {
      setFilteredBlockchain(blockchain);
      return;
    }

    const filtered = blockchain.map(block => {
      const matchingTransactions = block.transactions?.filter(tx => 
        tx.batch_id?.toLowerCase().includes(searchBatchId.toLowerCase())
      ) || [];
      
      if (matchingTransactions.length > 0) {
        return {
          ...block,
          transactions: matchingTransactions
        };
      }
      return null;
    }).filter(block => block !== null);

    setFilteredBlockchain(filtered);
  };

  const handleViewModeChange = (mode) => {
    setBlockchainView(mode);
    if (mode === 'all') {
      setSearchBatchId('');
      setFilteredBlockchain(blockchain);
      setShowBatchList(false);
    } else if (mode === 'batch') {
      setShowBatchList(false);
    }
  };

  const handleBatchSelect = (batchId) => {
    setSearchBatchId(batchId);
    setShowBatchList(false);
    
    const filtered = blockchain.map(block => {
      const matchingTransactions = block.transactions?.filter(tx => 
        tx.batch_id === batchId
      ) || [];
      
      if (matchingTransactions.length > 0) {
        return {
          ...block,
          transactions: matchingTransactions
        };
      }
      return null;
    }).filter(block => block !== null);

    setFilteredBlockchain(filtered);
  };

  const fetchPendingUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/pending-users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setPendingUsers(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching pending users:', error);
      alert('Failed to load pending users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    if (!confirm('Are you sure you want to approve this user?')) {
      return;
    }

    setProcessing(userId);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/approve-user`,
        { user_id: userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('User approved successfully!');
        fetchPendingUsers();
      }
    } catch (error) {
      console.error('Error approving user:', error);
      alert(error.response?.data?.message || 'Failed to approve user. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (userId) => {
    if (!confirm('Are you sure you want to reject and delete this user? This action cannot be undone.')) {
      return;
    }

    setProcessing(userId);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/reject-user`,
        { user_id: userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('User rejected and removed successfully.');
        fetchPendingUsers();
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
      alert(error.response?.data?.message || 'Failed to reject user. Please try again.');
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
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
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
            <h2 className="text-2xl font-bold text-gray-800">Pending User Approvals</h2>
            <button
              onClick={fetchPendingUsers}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Loading pending users...</span>
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No pending approvals</p>
              <p className="text-gray-400 text-sm mt-2">All users have been processed</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Username
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registered
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingUsers.map((pendingUser) => (
                    <tr key={pendingUser.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="w-5 h-5 text-gray-400 mr-2" />
                          <span className="text-sm font-medium text-gray-900">
                            {pendingUser.full_name || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {pendingUser.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {pendingUser.email || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {pendingUser.role_name || 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(pendingUser.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleApprove(pendingUser.id)}
                            disabled={processing === pendingUser.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processing === pendingUser.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Approve
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleReject(pendingUser.id)}
                            disabled={processing === pendingUser.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processing === pendingUser.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                Reject
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Blockchain Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mt-8">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <Database className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-800">Blockchain Explorer</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchBlockchainData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Refresh
              </button>
              <button
                onClick={() => setShowBlockchain(!showBlockchain)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                {showBlockchain ? 'Hide' : 'Show'} Blockchain
              </button>
            </div>
          </div>

          {blockchainLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Loading blockchain...</span>
            </div>
          ) : showBlockchain ? (
            <div className="space-y-4">
              {/* View Mode Toggle */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={() => handleViewModeChange('all')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      blockchainView === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    View All Blocks
                  </button>
                  <button
                    onClick={() => handleViewModeChange('batch')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      blockchainView === 'batch'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Search by Batch ID
                  </button>
                </div>

                {blockchainView === 'batch' && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={searchBatchId}
                        onChange={(e) => setSearchBatchId(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleBatchSearch()}
                        placeholder="Enter Batch ID or Code (e.g., BATCH-20231210-1234)"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={handleBatchSearch}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Search
                      </button>
                      {searchBatchId && (
                        <button
                          onClick={() => {
                            setSearchBatchId('');
                            setFilteredBlockchain(blockchain);
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Batch Selection Dropdown */}
                    <div className="border-t border-gray-200 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-700">
                          Or select from existing batches:
                        </p>
                        <button
                          onClick={() => setShowBatchList(!showBatchList)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {showBatchList ? 'Hide List' : `Show All Batches (${allBatches.length})`}
                        </button>
                      </div>

                      {showBatchList && (
                        <div className="bg-white border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                          {batchesLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                              <span className="text-sm text-gray-600">Loading batches...</span>
                            </div>
                          ) : allBatches.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 text-sm">
                              No batches found in blockchain
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-200">
                              {allBatches.map((batchId, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleBatchSelect(batchId)}
                                  className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors ${
                                    searchBatchId === batchId ? 'bg-blue-100' : ''
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-sm text-gray-800">{batchId}</span>
                                    {searchBatchId === batchId && (
                                      <CheckCircle className="w-4 h-4 text-blue-600" />
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-blue-900">
                    <strong>Total Blocks:</strong> {filteredBlockchain.length} | 
                    <strong className="ml-2">Total Transactions:</strong> {filteredBlockchain.reduce((acc, b) => acc + (b.transactions?.length || 0), 0)}
                    {blockchainView === 'batch' && searchBatchId && (
                      <span className="ml-2 text-blue-700">
                        (Filtered by: <strong>{searchBatchId}</strong>)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              
              {filteredBlockchain.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    {blockchainView === 'batch' && searchBatchId
                      ? `No blocks found with Batch ID containing "${searchBatchId}"`
                      : 'No blocks found in blockchain'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {filteredBlockchain.map((block, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Block #{block.index}</h3>
                          <p className="text-xs text-gray-500 mt-1">
                            Timestamp: {block.timestamp ? new Date(block.timestamp).toLocaleString() : 'Genesis Block'}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                          {block.transactions?.length || 0} Tx
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex gap-2">
                          <span className="font-medium text-gray-600">Hash:</span>
                          <span className="text-gray-800 font-mono text-xs break-all">{block.hash}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-medium text-gray-600">Previous Hash:</span>
                          <span className="text-gray-800 font-mono text-xs break-all">{block.previous_hash}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-medium text-gray-600">Nonce:</span>
                          <span className="text-gray-800">{block.nonce}</span>
                        </div>
                      </div>

                      {block.transactions && block.transactions.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h4 className="font-semibold text-gray-700 mb-2">Transactions:</h4>
                          <div className="space-y-2">
                            {block.transactions.map((tx, txIndex) => (
                              <div key={txIndex} className="bg-gray-50 rounded p-3 text-xs">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <span className="font-medium text-gray-600">Batch ID:</span>
                                    <p className="text-gray-800 font-mono">{tx.batch_id}</p>
                                  </div>
                                  <div>
                                    <span className="font-medium text-gray-600">Event Type:</span>
                                    <p className="text-gray-800">{tx.event_type}</p>
                                  </div>
                                  <div className="col-span-2">
                                    <span className="font-medium text-gray-600">Data:</span>
                                    <pre className="text-gray-800 mt-1 overflow-x-auto whitespace-pre-wrap bg-gray-100 p-2 rounded text-xs">
                                      {(() => {
                                        try {
                                          // Try to parse if it's a JSON string
                                          const parsed = typeof tx.data === 'string' ? JSON.parse(tx.data) : tx.data;
                                          return JSON.stringify(parsed, null, 2);
                                        } catch (e) {
                                          // If parsing fails, display as-is
                                          return tx.data || 'No data';
                                        }
                                      })()}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Click "Show Blockchain" to view all blocks and transactions</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;












