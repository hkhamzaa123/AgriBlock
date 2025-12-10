const { Product, Batch, Status, EventType, Event, ProductChainLog } = require('../models');
const { generateBatchCode } = require('../utils/batchCodeGenerator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { submitTransaction } = require('../utils/blockchainClient');

/**
 * POST /api/farmer/products
 * Create a product definition (template)
 */
const createProduct = async (req, res) => {
  try {
    const { title, crop_details } = req.body;
    const farmer_id = req.user.id || req.user.user_id;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Product title is required',
      });
    }

    const productId = uuidv4();
    const product = await Product.create({
      id: productId,
      farmer_id,
      title,
      crop_details: crop_details || null,
    });

    // Submit to blockchain
    await submitTransaction({
      sender: farmer_id,
      recipient: farmer_id, // Same user for product creation
      batch_id: `PRODUCT-${productId}`,
      event_type: 'PRODUCT_CREATED',
      data: {
        product_id: productId,
        title,
        crop_details: crop_details || null,
        timestamp: new Date().toISOString(),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    });
  } catch (error) {
    console.error('createProduct error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message,
    });
  }
};

/**
 * GET /api/farmer/products
 * Get all products created by the farmer
 */
const getMyProducts = async (req, res) => {
  try {
    const farmer_id = req.user.id || req.user.user_id;
    const products = await Product.findByFarmerId(farmer_id);

    res.status(200).json({
      success: true,
      message: 'Products retrieved successfully',
      data: products,
      count: products.length,
    });
  } catch (error) {
    console.error('getMyProducts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message,
    });
  }
};

/**
 * POST /api/farmer/batches
 * Create a batch (harvest) - PHASE 1: The Harvest
 * Sets initial_quantity = remaining_quantity, parent_batch_id = NULL, status = "Harvested"
 */
const createBatch = async (req, res) => {
  let connection;

  try {
    const { product_id, initial_quantity, quantity_unit, harvest_date } = req.body;
    const farmer_id = req.user.id || req.user.user_id;

    if (!product_id || !initial_quantity) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    console.log(`[Farmer] Creating Batch for Product ${product_id} by User ${farmer_id}`);

    // 1. Get/Create 'Harvested' Status ID
    let [s] = await connection.execute("SELECT id FROM statuses WHERE name = 'Harvested'");
    if (s.length === 0) {
      const newStatusId = uuidv4();
      await connection.execute("INSERT INTO statuses (id, name) VALUES (?, 'Harvested')", [newStatusId]);
      s = [{ id: newStatusId }];
    }
    const statusId = s[0].id;

    // 2. Generate Batch Details
    const batchId = uuidv4();
    // Generate Code: BATCH-YYYYMMDD-RANDOM
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
    const batchCode = `BATCH-${dateStr}-${uniqueSuffix}-${uuidv4().slice(0, 4).toUpperCase()}`;

    // 3. Insert Batch
    // Schema: id, product_id, parent_batch_id, batch_code, current_owner_id, current_status_id, initial_quantity, remaining_quantity, quantity_unit, harvest_date
    await connection.execute(
      `
      INSERT INTO batches 
      (id, product_id, parent_batch_id, batch_code, current_owner_id, current_status_id, initial_quantity, remaining_quantity, quantity_unit, harvest_date) 
      VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        batchId,
        product_id,
        batchCode,
        farmer_id,
        statusId,
        initial_quantity,
        initial_quantity, // Remaining = Initial at start
        quantity_unit || 'kg',
        harvest_date || new Date(),
      ]
    );

    // 4. Log Event
    const eventId = uuidv4();
    // Get 'Harvest' Event Type
    let [et] = await connection.execute("SELECT id FROM event_types WHERE name = 'Harvest'");
    let eventTypeId;
    if (et.length === 0) {
      // Fallback or create
      const newEtId = uuidv4();
      await connection.execute("INSERT INTO event_types (id, name) VALUES (?, 'Harvest')", [newEtId]);
      eventTypeId = newEtId;
    } else {
      eventTypeId = et[0].id;
    }

    await connection.execute(
      `
        INSERT INTO events (id, event_type_id, batch_id, actor_user_id, recorded_at)
        VALUES (?, ?, ?, ?, NOW())
    `,
      [eventId, eventTypeId, batchId, farmer_id]
    );

    await connection.commit();
    console.log(`[Farmer] Batch Created Successfully: ${batchCode}`);

    // Submit to blockchain
    await submitTransaction({
      sender: farmer_id,
      recipient: farmer_id,
      batch_id: batchCode,
      event_type: 'HARVEST',
      data: {
        batch_id: batchId,
        batch_code: batchCode,
        product_id,
        initial_quantity,
        quantity_unit: quantity_unit || 'kg',
        harvest_date: harvest_date || new Date().toISOString(),
        timestamp: new Date().toISOString(),
      },
    });

    res.status(201).json({ message: 'Batch created successfully', batch_code: batchCode });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[Farmer Error] Create Batch Failed:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * GET /api/farmer/batches
 * Get all batches owned by the farmer
 */
const getMyBatches = async (req, res) => {
  try {
    const farmer_id = req.user.id || req.user.user_id;
    const batches = await Batch.findByOwnerId(farmer_id);

    res.status(200).json({
      success: true,
      message: 'Batches retrieved successfully',
      data: batches,
      count: batches.length,
    });
  } catch (error) {
    console.error('getMyBatches error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch batches',
      error: error.message,
    });
  }
};

/**
 * POST /api/farmer/events
 * Log an event (e.g., Fertilizer Applied, Pesticide Applied, Irrigation)
 * This updates product_chain_log and batches.current_status automatically
 */
const logEvent = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { batch_id, event_type_name, location_coords, description } = req.body;
    const farmer_id = req.user.id || req.user.user_id;

    if (!batch_id || !event_type_name) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'batch_id and event_type_name are required',
      });
    }

    // Verify batch exists and belongs to farmer
    const batch = await Batch.findById(batch_id);
    if (!batch) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    if (batch.current_owner_id !== farmer_id) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: 'You do not own this batch',
      });
    }

    // Find event type
    const eventType = await EventType.findByName(event_type_name);
    if (!eventType) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Event type "${event_type_name}" not found`,
      });
    }

    // Create event
    const eventId = uuidv4();
    const event = await Event.create({
      id: eventId,
      event_type_id: eventType.id,
      batch_id,
      actor_user_id: farmer_id,
      location_coords: location_coords || null,
      blockchain_tx_hash: null,
    });

    // Update product_chain_log (performance cache)
    const logId = uuidv4();
    await ProductChainLog.create({
      log_id: logId,
      product_id: batch.product_id,
      batch_id,
      event_id: eventId,
      status_id: batch.current_status_id, // Keep current status unless event changes it
    });

    // Note: Status update logic would go here if the event type requires status change
    // For now, we keep the current status

    await connection.commit();

    // Submit to blockchain
    await submitTransaction({
      sender: farmer_id,
      recipient: farmer_id,
      batch_id: batch.batch_code,
      event_type: event_type_name.toUpperCase().replace(/\s+/g, '_'),
      data: {
        event_id: eventId,
        event_type: event_type_name,
        batch_id,
        batch_code: batch.batch_code,
        location_coords: location_coords || null,
        description: description || null,
        timestamp: new Date().toISOString(),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Event logged successfully',
      data: {
        event,
        log_entry: await ProductChainLog.findById(logId),
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('logEvent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log event',
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  createProduct,
  getMyProducts,
  createBatch,
  getMyBatches,
  logEvent,
};
