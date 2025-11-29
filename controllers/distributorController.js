const { Batch, Product, Status, EventType, Event, ProductChainLog } = require('../models');
const { generateBatchCode } = require('../utils/batchCodeGenerator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

/**
 * GET /api/distributor/marketplace
 * Get all available batches for purchase (status = "Harvested")
 */
const getMarketplace = async (req, res) => {
  try {
    // Get all batches with status "Harvested" that have remaining_quantity > 0
    const harvestedStatus = await Status.findByName('Harvested');
    if (!harvestedStatus) {
      return res.status(500).json({
        success: false,
        message: 'Harvested status not found in database',
      });
    }

    const [rows] = await db.execute(
      `SELECT b.*, 
              p.title as product_title, p.crop_details,
              u.username as owner_username, u.full_name as owner_name,
              s.name as status_name
       FROM batches b
       LEFT JOIN products p ON b.product_id = p.id
       LEFT JOIN users u ON b.current_owner_id = u.id
       LEFT JOIN statuses s ON b.current_status_id = s.id
       WHERE b.current_status_id = ? 
         AND b.remaining_quantity > 0
         AND b.parent_batch_id IS NULL
       ORDER BY b.created_at DESC`,
      [harvestedStatus.id]
    );

    res.status(200).json({
      success: true,
      message: 'Marketplace retrieved successfully',
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error('getMarketplace error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch marketplace',
      error: error.message,
    });
  }
};

/**
 * POST /api/distributor/buy
 * Purchase a batch (changes ownership)
 */
const buyBatch = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { batch_id } = req.body;
    const distributor_id = req.user.user_id;

    if (!batch_id) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'batch_id is required',
      });
    }

    // Get batch with lock
    const [batchRows] = await connection.execute(
      `SELECT * FROM batches WHERE id = ? FOR UPDATE`,
      [batch_id]
    );

    if (batchRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    const batch = batchRows[0];

    // Verify batch is available for purchase
    const harvestedStatus = await Status.findByName('Harvested');
    if (batch.current_status_id !== harvestedStatus.id) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Batch is not available for purchase (must be Harvested)',
      });
    }

    if (batch.remaining_quantity <= 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Batch has no remaining quantity',
      });
    }

    // Change ownership
    await Batch.update(batch_id, { 
      current_owner_id: distributor_id 
    });

    // Create "Sold" event
    const soldEventType = await EventType.findByName('Sold');
    if (soldEventType) {
      const eventId = uuidv4();
      await Event.create({
        id: eventId,
        event_type_id: soldEventType.id,
        batch_id,
        actor_user_id: distributor_id,
        location_coords: null,
        blockchain_tx_hash: null,
      });

      // Update product_chain_log
      const logId = uuidv4();
      await ProductChainLog.create({
        log_id: logId,
        product_id: batch.product_id,
        batch_id,
        event_id: eventId,
        status_id: batch.current_status_id,
      });
    }

    await connection.commit();

    const updatedBatch = await Batch.findById(batch_id);

    res.status(200).json({
      success: true,
      message: 'Batch purchased successfully',
      data: updatedBatch,
    });
  } catch (error) {
    await connection.rollback();
    console.error('buyBatch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to purchase batch',
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/**
 * POST /api/distributor/split-batch
 * PHASE 3: Split a batch into smaller batches (recursive genealogy)
 * Creates new batch rows with parent_batch_id pointing to original
 * Reduces parent batch remaining_quantity
 */
const splitBatch = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { parent_batch_id, splits } = req.body; // splits = [{quantity, quantity_unit}, ...]
    const distributor_id = req.user.user_id;

    if (!parent_batch_id || !splits || !Array.isArray(splits) || splits.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'parent_batch_id and splits array are required',
      });
    }

    // Get parent batch with lock
    const [parentRows] = await connection.execute(
      `SELECT * FROM batches WHERE id = ? FOR UPDATE`,
      [parent_batch_id]
    );

    if (parentRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Parent batch not found',
      });
    }

    const parentBatch = parentRows[0];

    // Verify ownership
    if (parentBatch.current_owner_id !== distributor_id) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: 'You do not own this batch',
      });
    }

    // Calculate total quantity to split
    const totalSplitQuantity = splits.reduce((sum, split) => {
      return sum + parseFloat(split.quantity || 0);
    }, 0);

    // Verify remaining_quantity is sufficient
    const remainingQty = parseFloat(parentBatch.remaining_quantity);
    if (totalSplitQuantity > remainingQty) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Insufficient quantity. Available: ${remainingQty}, Requested: ${totalSplitQuantity}`,
      });
    }

    // Get status for new batches
    const processingStatus = await Status.findByName('Processing');
    const inWarehouseStatus = await Status.findByName('In Warehouse');
    const statusId = processingStatus ? processingStatus.id : inWarehouseStatus.id;

    // Create child batches
    const childBatches = [];
    for (const split of splits) {
      const quantity = parseFloat(split.quantity);
      const quantityUnit = split.quantity_unit || parentBatch.quantity_unit;

      if (quantity <= 0) {
        continue; // Skip invalid quantities
      }

      const childBatchId = uuidv4();
      const childBatchCode = generateBatchCode();

      await Batch.create({
        id: childBatchId,
        product_id: parentBatch.product_id,
        parent_batch_id: parent_batch_id, // Link to parent
        batch_code: childBatchCode,
        current_owner_id: distributor_id,
        current_status_id: statusId,
        initial_quantity: quantity,
        remaining_quantity: quantity,
        quantity_unit: quantityUnit,
        harvest_date: parentBatch.harvest_date,
      });

      childBatches.push({
        id: childBatchId,
        batch_code: childBatchCode,
        quantity,
        quantity_unit: quantityUnit,
      });

      // Create "Split" event for child batch
      const splitEventType = await EventType.findByName('Split');
      if (splitEventType) {
        const eventId = uuidv4();
        await Event.create({
          id: eventId,
          event_type_id: splitEventType.id,
          batch_id: childBatchId,
          actor_user_id: distributor_id,
          location_coords: null,
          blockchain_tx_hash: null,
        });

        // Update product_chain_log
        const logId = uuidv4();
        await ProductChainLog.create({
          log_id: logId,
          product_id: parentBatch.product_id,
          batch_id: childBatchId,
          event_id: eventId,
          status_id: statusId,
        });
      }
    }

    // Reduce parent batch remaining_quantity
    const newRemainingQty = remainingQty - totalSplitQuantity;
    await Batch.update(parent_batch_id, {
      remaining_quantity: newRemainingQty,
    });

    // If parent is fully split, update status
    if (newRemainingQty <= 0) {
      const inWarehouseStatus = await Status.findByName('In Warehouse');
      if (inWarehouseStatus) {
        await Batch.update(parent_batch_id, {
          current_status_id: inWarehouseStatus.id,
        });
      }
    }

    await connection.commit();

    const updatedParent = await Batch.findById(parent_batch_id);

    res.status(201).json({
      success: true,
      message: 'Batch split successfully',
      data: {
        parent_batch: updatedParent,
        child_batches: childBatches,
        total_split: totalSplitQuantity,
        remaining_in_parent: newRemainingQty,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('splitBatch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to split batch',
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

/**
 * GET /api/distributor/inventory
 * Get all batches owned by distributor
 */
const getMyInventory = async (req, res) => {
  try {
    const distributor_id = req.user.user_id;
    const batches = await Batch.findByOwnerId(distributor_id);

    res.status(200).json({
      success: true,
      message: 'Inventory retrieved successfully',
      data: batches,
      count: batches.length,
    });
  } catch (error) {
    console.error('getMyInventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory',
      error: error.message,
    });
  }
};

module.exports = {
  getMarketplace,
  buyBatch,
  splitBatch,
  getMyInventory,
};
