const { Product, Batch, Status, EventType, Event, ProductChainLog } = require('../models');
const { generateBatchCode } = require('../utils/batchCodeGenerator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

/**
 * POST /api/farmer/products
 * Create a product definition (template)
 */
const createProduct = async (req, res) => {
  try {
    const { title, crop_details } = req.body;
    const farmer_id = req.user.user_id;

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
    const farmer_id = req.user.user_id;
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
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { product_id, initial_quantity, quantity_unit, harvest_date } = req.body;
    const farmer_id = req.user.user_id;

    if (!product_id || !initial_quantity || !quantity_unit) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'product_id, initial_quantity, and quantity_unit are required',
      });
    }

    const parsedQuantity = parseFloat(initial_quantity);
    if (Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'initial_quantity must be a positive number',
      });
    }

    // Verify product belongs to farmer
    const product = await Product.findById(product_id);
    if (!product) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (product.farmer_id !== farmer_id) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: 'You do not own this product',
      });
    }

    // Get "Harvested" status
    const harvestedStatus = await Status.findByName('Harvested');
    if (!harvestedStatus) {
      await connection.rollback();
      return res.status(500).json({
        success: false,
        message: 'Harvested status not found in database',
      });
    }

    // Create batch
    const batchId = uuidv4();
    const batchCode = generateBatchCode();
    const batch = await Batch.create({
      id: batchId,
      product_id,
      parent_batch_id: null, // Source batch - no parent
      batch_code: batchCode,
      current_owner_id: farmer_id,
      current_status_id: harvestedStatus.id,
      initial_quantity: parsedQuantity,
      remaining_quantity: parsedQuantity, // Initially equal
      quantity_unit: quantity_unit,
      harvest_date: harvest_date || new Date(),
    });

    // Get "Harvest" event type
    const harvestEventType = await EventType.findByName('Harvest');
    if (!harvestEventType) {
      await connection.rollback();
      return res.status(500).json({
        success: false,
        message: 'Harvest event type not found in database',
      });
    }

    // Create Harvest event
    const eventId = uuidv4();
    const event = await Event.create({
      id: eventId,
      event_type_id: harvestEventType.id,
      batch_id: batchId,
      actor_user_id: farmer_id,
      location_coords: null,
      blockchain_tx_hash: null,
    });

    // Update product_chain_log (performance cache)
    const logId = uuidv4();
    await ProductChainLog.create({
      log_id: logId,
      product_id,
      batch_id: batchId,
      event_id: eventId,
      status_id: harvestedStatus.id,
    });

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Batch created and harvested successfully',
      data: {
        batch: batch,
        event: event,
        batch_code: batchCode, // For QR code generation
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('createBatch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create batch',
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/**
 * GET /api/farmer/batches
 * Get all batches owned by the farmer
 */
const getMyBatches = async (req, res) => {
  try {
    const farmer_id = req.user.user_id;
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
    const farmer_id = req.user.user_id;

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
