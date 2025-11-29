import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, QrCode, Loader2, Calendar, MapPin, Package, ArrowUp, ArrowDown, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const ConsumerDashboard = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [batchCode, setBatchCode] = useState('');
  const [traceabilityData, setTraceabilityData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (!batchCode.trim()) {
      setError('Please enter a batch code');
      return;
    }

    setLoading(true);
    setError('');
    setTraceabilityData(null);

    try {
      const response = await axios.get(
        `${API_BASE_URL}/traceability/batch/${batchCode.trim()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setTraceabilityData(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching traceability:', err);
      setError(err.response?.data?.message || 'Failed to fetch traceability data. Please check the batch code.');
      setTraceabilityData(null);
    } finally {
      setLoading(false);
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

  const renderGenealogyTree = (tree, level = 0) => {
    if (!tree || !tree.batch) return null;

    return (
      <div className={`ml-${level * 4} border-l-2 border-gray-300 pl-4 mb-4`}>
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-5 h-5 text-blue-600" />
                <span className="font-mono text-sm font-semibold">{tree.batch.batch_code}</span>
                {level === 0 && <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Current</span>}
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="font-medium">Product:</span> {tree.batch.product?.title || 'Unknown'}</p>
                <p><span className="font-medium">Quantity:</span> {tree.batch.remaining_quantity} / {tree.batch.initial_quantity} {tree.batch.quantity_unit}</p>
                <p><span className="font-medium">Status:</span> {tree.batch.current_status || 'Unknown'}</p>
                {tree.batch.harvest_date && (
                  <p><span className="font-medium">Harvested:</span> {formatDate(tree.batch.harvest_date)}</p>
                )}
              </div>
            </div>
            {level > 0 && (
              <div className="flex items-center text-gray-400">
                <ArrowDown className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>
        {tree.parent && (
          <div className="mt-2">
            <div className="flex items-center text-gray-400 mb-2">
              <ArrowUp className="w-4 h-4" />
              <span className="text-xs ml-2">Parent Batch</span>
            </div>
            {renderGenealogyTree(tree.parent, level + 1)}
          </div>
        )}
        {tree.children && tree.children.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center text-gray-400 mb-2">
              <ArrowDown className="w-4 h-4" />
              <span className="text-xs ml-2">Child Batches ({tree.children.length})</span>
            </div>
            {tree.children.map((child, idx) => (
              <div key={idx}>
                {renderGenealogyTree(child, level + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
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
        {/* Scan Section */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Trace Product</h2>
          <p className="text-gray-600 mb-6">
            Enter or scan the batch code (QR code) to view the complete product history from farm to plate.
          </p>
          
          <form onSubmit={handleScan} className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                placeholder="Enter batch code (e.g., BATCH-20241201-120000-XXXX)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !batchCode.trim()}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <QrCode className="w-5 h-5" />
                  Trace
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Traceability Results */}
        {traceabilityData && (
          <div className="space-y-6">
            {/* Batch Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Product Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Product</p>
                  <p className="font-semibold text-gray-800">{traceabilityData.batch.product?.title || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Batch Code</p>
                  <p className="font-mono font-semibold text-gray-800">{traceabilityData.batch.batch_code}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Current Owner</p>
                  <p className="font-semibold text-gray-800">
                    {traceabilityData.batch.current_owner?.username || 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="font-semibold text-gray-800">{traceabilityData.batch.current_status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Quantity</p>
                  <p className="font-semibold text-gray-800">
                    {traceabilityData.batch.remaining_quantity} / {traceabilityData.batch.initial_quantity} {traceabilityData.batch.quantity_unit}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Harvest Date</p>
                  <p className="font-semibold text-gray-800">{formatDate(traceabilityData.batch.harvest_date)}</p>
                </div>
              </div>
            </div>

            {/* Genealogy Tree */}
            {traceabilityData.genealogy && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Product Genealogy</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {traceabilityData.genealogy.is_root 
                    ? 'This is the original harvest batch (root batch).'
                    : `This batch was split from parent batch: ${traceabilityData.genealogy.parent_batch_code || 'Unknown'}`}
                </p>
                {traceabilityData.genealogy.tree && renderGenealogyTree(traceabilityData.genealogy.tree)}
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Product Journey Timeline</h3>
              <div className="space-y-4">
                {traceabilityData.timeline && traceabilityData.timeline.length > 0 ? (
                  traceabilityData.timeline.map((event, index) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-indigo-600 rounded-full"></div>
                        {index < traceabilityData.timeline.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-300 mt-2"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-semibold text-gray-800">{event.event_type}</h4>
                              <p className="text-sm text-gray-600">
                                {event.actor && `By: ${event.actor}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">{formatDate(event.recorded_at)}</p>
                              {event.location && (
                                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                  <MapPin className="w-3 h-3" />
                                  {event.location}
                                </div>
                              )}
                            </div>
                          </div>
                          {event.attachments && event.attachments.length > 0 && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                              <FileText className="w-4 h-4" />
                              <span>{event.attachments.length} attachment(s)</span>
                            </div>
                          )}
                          {event.iot_data && event.iot_data.length > 0 && (
                            <div className="mt-2 text-xs text-gray-600">
                              <span className="font-medium">IoT Data:</span> {event.iot_data.length} reading(s)
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No events recorded yet.</p>
                )}
              </div>
            </div>

            {/* Journey Summary */}
            {traceabilityData.summary && (
              <div className="bg-indigo-50 rounded-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-3">Journey Summary</h3>
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Origin:</span> {traceabilityData.summary.origin}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Total Events:</span> {traceabilityData.summary.total_events}
                  </p>
                  {traceabilityData.summary.journey && traceabilityData.summary.journey.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Key Milestones:</p>
                      <ul className="space-y-1">
                        {traceabilityData.summary.journey.map((milestone, idx) => (
                          <li key={idx} className="text-sm text-gray-600">{milestone}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!traceabilityData && !loading && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">How to Use</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Scan the QR code on your product package to get the batch code</li>
              <li>Enter the batch code in the field above</li>
              <li>View the complete product history from farm to your plate</li>
              <li>See all events, locations, and certifications</li>
              <li>Track the product genealogy (parent-child relationships)</li>
            </ul>
          </div>
        )}
      </main>
    </div>
  );
};

export default ConsumerDashboard;
