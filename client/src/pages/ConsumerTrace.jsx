import React, { useState } from 'react';
import { Search, Loader2, Sprout, Factory, Truck, Store, Calendar, MapPin, FileText, Thermometer, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';

const ConsumerTrace = () => {
  const [batchCode, setBatchCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [traceData, setTraceData] = useState(null);
  const [error, setError] = useState(null);
  const [showProof, setShowProof] = useState({});

  const handleSearch = async () => {
    if (!batchCode.trim()) {
      setError('Please enter a batch code');
      return;
    }

    setLoading(true);
    setError(null);
    setTraceData(null);

    try {
      const response = await axios.get(`http://localhost:5000/api/traceability/batch/${batchCode.trim()}`);
      if (response.data.success) {
        setTraceData(response.data.data);
      } else {
        setError(response.data.message || 'Failed to fetch traceability data');
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Batch code not found. Please check and try again.');
      } else {
        setError(err.response?.data?.message || 'Error fetching traceability data');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleProof = (eventId) => {
    setShowProof(prev => ({
      ...prev,
      [eventId]: !prev[eventId]
    }));
  };

  const renderStage = (title, icon, stages, color) => {
    if (!stages || stages.length === 0) return null;

    return (
      <div className="mb-8">
        <div className={`flex items-center gap-2 mb-4 ${color}`}>
          {icon}
          <h3 className="text-xl font-bold">{title}</h3>
          <span className="text-sm text-gray-500">({stages.length} event{stages.length !== 1 ? 's' : ''})</span>
        </div>
        <div className="space-y-4">
          {stages.map((stage, idx) => (
            <div key={stage.id || idx} className="border-l-4 border-gray-300 pl-4 py-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-800">{stage.event_type}</span>
                    {stage.owner_name && (
                      <span className="text-sm text-gray-600">by {stage.owner_name}</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    {formatDate(stage.recorded_at)}
                  </div>
                  {stage.location && (
                    <div className="text-sm text-gray-600 mb-2">
                      <MapPin className="w-4 h-4 inline mr-1" />
                      {stage.location}
                    </div>
                  )}
                  {(stage.attachments?.length > 0 || stage.iot_data?.length > 0) && (
                    <button
                      onClick={() => toggleProof(stage.id)}
                      className="mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition-colors flex items-center gap-1"
                    >
                      <FileText className="w-4 h-4" />
                      {showProof[stage.id] ? 'Hide' : 'View'} Proof
                    </button>
                  )}
                  {showProof[stage.id] && (
                    <div className="mt-3 space-y-2">
                      {stage.attachments?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Attachments:</p>
                          {stage.attachments.map((att, attIdx) => (
                            <div key={attIdx} className="text-sm text-gray-600 ml-4">
                              <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {att.description || 'View File'}
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                      {stage.iot_data?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                            <Thermometer className="w-4 h-4" />
                            IoT Data:
                          </p>
                          {stage.iot_data.map((iot, iotIdx) => (
                            <div key={iotIdx} className="text-sm text-gray-600 ml-4 font-mono bg-gray-50 p-2 rounded">
                              {iot.raw_data || 'No data'}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Sprout className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Product Traceability</h1>
              <p className="text-sm text-gray-600">Track your product from farm to table</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter Batch Code (e.g., BATCH-2024-001)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Tracking...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Track
                </>
              )}
            </button>
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <XCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Traceability Story */}
        {traceData && (
          <div className="space-y-6">
            {/* Product Header */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    {traceData.batch?.product?.title || 'Unknown Product'}
                  </h2>
                  <p className="text-gray-600 mb-1">
                    <span className="font-medium">Batch Code:</span> {traceData.batch?.batch_code}
                  </p>
                  <p className="text-gray-600 mb-1">
                    <span className="font-medium">Current Status:</span>{' '}
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-semibold">
                      {traceData.batch?.current_status || 'Unknown'}
                    </span>
                  </p>
                  {traceData.batch?.harvest_date && (
                    <p className="text-gray-600">
                      <span className="font-medium">Harvest Date:</span> {formatDate(traceData.batch.harvest_date)}
                    </p>
                  )}
                </div>
                <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
              </div>
            </div>

            {/* Timeline - Lifecycle Stages */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-6">Product Journey Timeline</h3>
              
              {/* Farmer Stage */}
              {renderStage(
                '🌱 Origin: Farm',
                <Sprout className="w-6 h-6 text-green-600" />,
                traceData.lifecycle_stages?.farmer || [],
                'text-green-700'
              )}

              {/* Distributor Stage */}
              {renderStage(
                '🏭 Processing: Distribution',
                <Factory className="w-6 h-6 text-blue-600" />,
                traceData.lifecycle_stages?.distributor || [],
                'text-blue-700'
              )}

              {/* Transporter Stage */}
              {renderStage(
                '🚚 Logistics: Transportation',
                <Truck className="w-6 h-6 text-orange-600" />,
                traceData.lifecycle_stages?.transporter || [],
                'text-orange-700'
              )}

              {/* Retailer Stage */}
              {renderStage(
                '🏪 Retail: Shop',
                <Store className="w-6 h-6 text-purple-600" />,
                traceData.lifecycle_stages?.retailer || [],
                'text-purple-700'
              )}

              {/* Fallback: Show all events if lifecycle_stages is empty */}
              {(!traceData.lifecycle_stages || 
                (traceData.lifecycle_stages.farmer?.length === 0 && 
                 traceData.lifecycle_stages.distributor?.length === 0 &&
                 traceData.lifecycle_stages.transporter?.length === 0 &&
                 traceData.lifecycle_stages.retailer?.length === 0)) && 
               traceData.timeline && traceData.timeline.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">All Events</h3>
                  <div className="space-y-4">
                    {traceData.timeline.map((event, idx) => (
                      <div key={event.id || idx} className="border-l-4 border-gray-300 pl-4 py-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-800">{event.event_type}</span>
                              {event.actor && (
                                <span className="text-sm text-gray-600">by {event.actor}</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              <Calendar className="w-4 h-4 inline mr-1" />
                              {formatDate(event.recorded_at)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!traceData.timeline || traceData.timeline.length === 0) && (
                <div className="text-center py-12 text-gray-500">
                  <p>No events found for this batch.</p>
                </div>
              )}
            </div>

            {/* Summary */}
            {traceData.summary && (
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-3">Journey Summary</h3>
                <ul className="space-y-2">
                  {traceData.summary.journey?.map((step, idx) => (
                    <li key={idx} className="text-gray-700">{step}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ConsumerTrace;












