const { Batch, Event, EventAttachment, DeviceRawData, Product, User, Status } = require('../models');
const db = require('../config/db');

/**
 * GET /api/traceability/batch/:batch_code
 * PHASE 5: The Traceability Engine
 * Consumer scans QR code (batch_code) and gets the full "Story"
 * - Fetches the current batch details
 * - Fetches the immediate events
 * - Traverses up the tree (using parent_batch_id) to fetch the Farmer's events
 */
const getBatchTraceability = async (req, res) => {
  try {
    const { batch_code } = req.params;

    if (!batch_code) {
      return res.status(400).json({
        success: false,
        message: 'batch_code is required',
      });
    }

    // Find batch by code
    const batch = await Batch.findByBatchCode(batch_code);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    // Get full genealogy tree (recursive)
    const genealogyTree = await Batch.getGenealogyTree(batch.id);

    // Get full event history (recursive - traverses up parent_batch_id)
    const allEvents = await Event.getFullHistory(batch.id);

    // Enrich events with attachments, IoT data, and owner role information
    const enrichedEvents = await Promise.all(
      allEvents.map(async (event) => {
        const attachments = await EventAttachment.findByEventId(event.id);
        const iotData = await DeviceRawData.findByEventId(event.id);
        
        // Get batch owner and role for this event
        const eventBatch = await Batch.findById(event.batch_id);
        let ownerRole = null;
        let ownerName = null;
        if (eventBatch && eventBatch.current_owner_id) {
          const [userRows] = await db.execute(
            `SELECT u.full_name, r.name as role_name
             FROM users u
             LEFT JOIN roles r ON u.role_id = r.id
             WHERE u.id = ?`,
            [eventBatch.current_owner_id]
          );
          if (userRows.length > 0) {
            ownerName = userRows[0].full_name;
            ownerRole = userRows[0].role_name;
          }
        }
        
        return {
          ...event,
          attachments,
          iot_data: iotData,
          owner_name: ownerName,
          owner_role: ownerRole,
        };
      })
    );

    // Get product details
    const product = await Product.findById(batch.product_id);

    // Build the "Story" - organized timeline
    const story = {
      batch: {
        id: batch.id,
        batch_code: batch.batch_code,
        product: product,
        current_owner: batch.owner_username ? {
          username: batch.owner_username,
          full_name: batch.owner_name,
        } : null,
        current_status: batch.status_name,
        initial_quantity: batch.initial_quantity,
        remaining_quantity: batch.remaining_quantity,
        quantity_unit: batch.quantity_unit,
        harvest_date: batch.harvest_date,
        created_at: batch.created_at,
      },
      genealogy: {
        is_root: !batch.parent_batch_id,
        parent_batch_code: batch.parent_batch_code || null,
        tree: genealogyTree,
      },
      timeline: enrichedEvents.map(event => ({
        id: event.id,
        event_type: event.event_type_name,
        recorded_at: event.recorded_at,
        actor: event.actor_username,
        actor_name: event.actor_name,
        owner_name: event.owner_name,
        owner_role: event.owner_role,
        location: event.location_coords,
        blockchain_tx: event.blockchain_tx_hash,
        attachments: event.attachments,
        iot_data: event.iot_data,
      })),
      lifecycle_stages: buildLifecycleStages(enrichedEvents),
      summary: {
        total_events: enrichedEvents.length,
        origin: genealogyTree?.parent ? 'Split from parent batch' : 'Harvested from farm',
        journey: buildJourneySummary(enrichedEvents),
      },
    };

    res.status(200).json({
      success: true,
      message: 'Traceability data retrieved successfully',
      data: story,
    });
  } catch (error) {
    console.error('getBatchTraceability error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch traceability data',
      error: error.message,
    });
  }
};

/**
 * Helper function to build journey summary
 */
function buildJourneySummary(events) {
  const journey = [];
  const eventTypes = events.map(e => e.event_type_name);
  
  if (eventTypes.includes('Harvest')) {
    journey.push('🌾 Harvested from farm');
  }
  if (eventTypes.includes('Fertilizer Applied')) {
    journey.push('🌱 Fertilizer applied');
  }
  if (eventTypes.includes('Pesticide Applied')) {
    journey.push('🛡️ Pesticide applied');
  }
  if (eventTypes.includes('Irrigation')) {
    journey.push('💧 Irrigated');
  }
  if (eventTypes.includes('Transport Start')) {
    journey.push('🚚 Transported');
  }
  if (eventTypes.includes('Quality Check')) {
    journey.push('✅ Quality checked');
  }
  if (eventTypes.includes('Split')) {
    journey.push('📦 Split into smaller batches');
  }
  if (eventTypes.includes('Sold')) {
    journey.push('💰 Sold');
  }

  return journey.length > 0 ? journey : ['📋 Product journey tracked'];
}

/**
 * Group events by lifecycle stages (Farmer, Distributor, Transporter, Retailer)
 */
function buildLifecycleStages(events) {
  const stages = {
    farmer: [],
    distributor: [],
    transporter: [],
    retailer: []
  };

  events.forEach(event => {
    const role = event.owner_role?.toUpperCase();
    const stage = {
      id: event.id,
      event_type: event.event_type_name,
      recorded_at: event.recorded_at,
      actor: event.actor_username || event.actor_name,
      owner_name: event.owner_name,
      owner_role: event.owner_role,
      location: event.location_coords,
      attachments: event.attachments || [],
      iot_data: event.iot_data || [],
    };

    if (role === 'FARMER') {
      stages.farmer.push(stage);
    } else if (role === 'DISTRIBUTOR') {
      stages.distributor.push(stage);
    } else if (role === 'TRANSPORTER') {
      stages.transporter.push(stage);
    } else if (role === 'RETAILER') {
      stages.retailer.push(stage);
    } else if (event.event_type_name === 'Harvest' || event.event_type_name === 'Fertilizer Applied' || event.event_type_name === 'Pesticide Applied' || event.event_type_name === 'Irrigation') {
      // Farm events without explicit role
      stages.farmer.push(stage);
    } else if (event.event_type_name === 'Shipment Assigned' || event.event_type_name === 'Picked Up' || event.event_type_name === 'In Transit' || event.event_type_name === 'Delivered') {
      // Transport events
      stages.transporter.push(stage);
    } else if (event.event_type_name === 'Sold' || event.event_type_name === 'Split') {
      // Distribution events
      stages.distributor.push(stage);
    }
  });

  return stages;
}

/**
 * GET /api/traceability/batch/:batch_code/genealogy
 * Get just the genealogy tree (parent-child relationships)
 */
const getGenealogyTree = async (req, res) => {
  try {
    const { batch_code } = req.params;

    const batch = await Batch.findByBatchCode(batch_code);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    const genealogyTree = await Batch.getGenealogyTree(batch.id);

    res.status(200).json({
      success: true,
      message: 'Genealogy tree retrieved successfully',
      data: genealogyTree,
    });
  } catch (error) {
    console.error('getGenealogyTree error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch genealogy tree',
      error: error.message,
    });
  }
};

/**
 * GET /api/traceability/batch/:batch_code/events
 * Get just the events timeline (without full traceability data)
 */
const getBatchEvents = async (req, res) => {
  try {
    const { batch_code } = req.params;

    const batch = await Batch.findByBatchCode(batch_code);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    const events = await Event.getFullHistory(batch.id);

    // Enrich with attachments and IoT data
    const enrichedEvents = await Promise.all(
      events.map(async (event) => {
        const attachments = await EventAttachment.findByEventId(event.id);
        const iotData = await DeviceRawData.findByEventId(event.id);
        return {
          ...event,
          attachments,
          iot_data: iotData,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: 'Events retrieved successfully',
      data: enrichedEvents,
      count: enrichedEvents.length,
    });
  } catch (error) {
    console.error('getBatchEvents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
      error: error.message,
    });
  }
};

module.exports = {
  getBatchTraceability,
  getGenealogyTree,
  getBatchEvents,
};

