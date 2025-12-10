const { Batch, Product, Status, EventType, Event, ProductChainLog } = require('../models');
const { generateBatchCode } = require('../utils/batchCodeGenerator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { submitTransaction } = require('../utils/blockchainClient');

/**
 * GET /api/distributor/marketplace
 * Get all available farmer batches for distributors to purchase
 * Status = "Harvested", remaining_quantity > 0
 */
const getMarketplace = async (req, res) => {
  let connection;

  try {
    connection = await db.getConnection();

    // 1. Fetch Harvested Batches with Farmer Name
    const [batches] = await connection.execute(
      `
      SELECT 
        b.id AS batch_id,
        b.batch_code,
        b.harvest_date,
        b.remaining_quantity,
        b.quantity_unit,
        b.product_id,
        p.title AS product_name,
        u.full_name AS farmer_name
      FROM batches b
      JOIN users u ON b.current_owner_id = u.id
      JOIN products p ON b.product_id = p.id
      JOIN statuses s ON b.current_status_id = s.id
      WHERE s.name = 'Harvested' 
        AND b.remaining_quantity > 0
    `
    );

    // 2. Add Pricing Logic (Virtual Field)
    const batchesWithPrice = batches.map((batch) => ({
      ...batch,
      // Fixed Base Price for Distributors (virtual pricing)
      price_per_kg: 5.0,
      // Frontend-friendly quantity keys
      available_quantity: Number(batch.remaining_quantity) || 0,
      quantity: Number(batch.remaining_quantity) || 0,
      // Ensure name fields exist for cards/modals
      crop_name: batch.product_name || batch.product_title || null,
    }));

    res.status(200).json({
      success: true,
      message: 'Marketplace retrieved successfully',
      data: batchesWithPrice,
      count: batchesWithPrice.length,
    });
  } catch (error) {
    console.error('Distributor Market Error:', error);
    res.status(500).json({ message: 'Error fetching marketplace' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * POST /api/distributor/buy
 * Purchase a batch (changes ownership)
 * Supports partial purchases - if quantity < remaining_quantity, creates a new batch for buyer
 */
const buyBatch = async (req, res) => {
  let connection;

  try {
    // Log exactly what we received for debugging
    console.log("Received Body:", req.body);
    
    // Allow req.body.id OR req.body.batch_id to work
    const batch_id = req.body.batch_id || req.body.id;
    // FORCE NUMBER CONVERSION
    const quantity = Number(req.body.quantity || req.body.quantity_to_buy);
    const buyer_id = req.user.id || req.user.user_id;

    console.log(`[Distributor] Buying Batch ${batch_id}, Qty: ${quantity}`);

    if (!batch_id || Number.isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quantity or missing batch ID',
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Lock the Batch Row
    const [batches] = await connection.execute(
      'SELECT * FROM batches WHERE id = ? FOR UPDATE',
      [batch_id]
    );
    if (batches.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }
    const batch = batches[0];
    const currentQty = Number(batch.remaining_quantity);

    // 2. Validate Stock
    if (quantity > currentQty) {
      await connection.rollback();
      return res
        .status(400)
        .json({ success: false, message: `Not enough stock. Available: ${currentQty}` });
    }

    // 3. Get/Create 'In Warehouse' Status
    let [s] = await connection.execute(
      "SELECT id FROM statuses WHERE name = 'In Warehouse'"
    );
    if (s.length === 0) {
      const newId = uuidv4();
      await connection.execute("INSERT INTO statuses (id, name) VALUES (?, 'In Warehouse')", [
        newId,
      ]);
      s = [{ id: newId }];
    }
    const inWarehouseId = s[0].id;

    // 4. EXECUTE BUY (Full vs Partial)
    if (quantity === currentQty) {
      // SCENARIO A: BUY ALL (Transfer Ownership)
      await connection.execute(
        'UPDATE batches SET current_owner_id = ?, current_status_id = ? WHERE id = ?',
        [buyer_id, inWarehouseId, batch_id]
      );
    } else {
      // SCENARIO B: PARTIAL SPLIT
      // A. Deduct from Farmer
      const newRemainder = currentQty - quantity;
      await connection.execute(
        'UPDATE batches SET remaining_quantity = ? WHERE id = ?',
        [newRemainder, batch_id]
      );

      // B. Create New Batch for Distributor
      const newBatchId = uuidv4();
      const newCode = `${batch.batch_code}-D${Date.now().toString().slice(-4)}`;

      await connection.execute(
        `
            INSERT INTO batches 
            (id, product_id, parent_batch_id, batch_code, current_owner_id, current_status_id, initial_quantity, remaining_quantity, quantity_unit, harvest_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          newBatchId,
          batch.product_id,
          batch.id, // Parent is Farmer's batch
          newCode,
          buyer_id,
          inWarehouseId,
          quantity,
          quantity,
          batch.quantity_unit,
          batch.harvest_date,
        ]
      );
    }

    await connection.commit();
    console.log('[Distributor] Buy Successful');

    // Get batch code for blockchain
    const [updatedBatch] = await connection.execute(
      'SELECT batch_code FROM batches WHERE id = ?',
      [batch_id]
    );

    // Submit to blockchain
    if (updatedBatch.length > 0) {
      await submitTransaction({
        sender: batch.current_owner_id,
        recipient: buyer_id,
        batch_id: updatedBatch[0].batch_code,
        event_type: 'DISTRIBUTOR_PURCHASE',
        data: {
          batch_id,
          quantity,
          buyer_id,
          seller_id: batch.current_owner_id,
          purchase_type: quantity === currentQty ? 'full' : 'partial',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Keep success flag for frontend compatibility
    res.json({ success: true, message: 'Purchase successful' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[Distributor Buy Error]', error);
    res.status(500).json({ success: false, message: 'Server Error during purchase' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * POST /api/distributor/split-batch
 * PHASE 3: Split a batch into smaller batches (recursive genealogy)
 * SIMPLIFIED VERSION - Safe and robust to prevent server crashes
 */
const splitBatch = async (req, res) => {
  let connection;

  try {
    const { parent_batch_id, splits } = req.body; // splits = [{quantity: 100, unit: 'kg'}, ...]
    const user_id = req.user.id || req.user.user_id;

    console.log(`[Split Batch] Request from User ${user_id} for Batch ${parent_batch_id}`);
    
    if (!parent_batch_id || !splits || !Array.isArray(splits)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid data provided" 
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Lock and Get Parent Batch
    const [parents] = await connection.execute(
      'SELECT * FROM batches WHERE id = ? FOR UPDATE', 
      [parent_batch_id]
    );

    if (parents.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ 
        success: false,
        message: "Parent batch not found" 
      });
    }
    const parent = parents[0];

    // 2. Validate Quantity
    const totalSplitNeeded = splits.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
    
    console.log(`[Split Batch] Total split needed: ${totalSplitNeeded}, Parent remaining: ${parent.remaining_quantity}`);
    
    if (Number(parent.remaining_quantity) < totalSplitNeeded) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ 
        success: false,
        message: `Not enough quantity. Have: ${parent.remaining_quantity}, Need: ${totalSplitNeeded}` 
      });
    }

    // 3. Get Status ID (Safe Lookup)
    const [statuses] = await connection.execute('SELECT id FROM statuses WHERE name = ?', ['In Warehouse']);
    const statusId = statuses.length > 0 ? statuses[0].id : parent.current_status_id;
    
    console.log(`[Split Batch] Using status ID: ${statusId}`);

    // 4. Create Children
    const childBatches = [];
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const quantity = Number(split.quantity || 0);
      
      if (quantity <= 0) {
        console.log(`[Split Batch] Skipping invalid split ${i + 1} with quantity ${quantity}`);
        continue;
      }
      
      const newBatchId = uuidv4();
      // Simple unique code generation
      const newBatchCode = `${parent.batch_code}-S${i + 1}-${Date.now().toString().slice(-4)}`;

      console.log(`[Split Batch] Creating child batch ${i + 1}: ${newBatchCode} with quantity ${quantity}`);

      await connection.execute(
        `INSERT INTO batches (id, product_id, parent_batch_id, batch_code, current_owner_id, current_status_id, initial_quantity, remaining_quantity, quantity_unit, harvest_date) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newBatchId, 
          parent.product_id, 
          parent.id, // LINK TO PARENT
          newBatchCode, 
          user_id, 
          statusId, 
          quantity, 
          quantity, // New batch starts full
          split.quantity_unit || split.unit || parent.quantity_unit || 'kg',
          parent.harvest_date
        ]
      );
      
      childBatches.push({
        id: newBatchId,
        batch_code: newBatchCode,
        quantity: quantity,
        quantity_unit: split.quantity_unit || split.unit || parent.quantity_unit || 'kg'
      });
      
      // Log "Split" Event (Optional - skipping for stability)
      try {
        // Event creation skipped for now to prevent crashes
        console.log(`[Split Batch] Child batch ${i + 1} created successfully`);
      } catch (logErr) {
        console.error(`[Split Batch] Failed to log event for child ${i + 1}, but batch created:`, logErr);
      }
    }

    // 5. Update Parent Quantity
    const newRemaining = Number(parent.remaining_quantity) - totalSplitNeeded;
    await connection.execute(
      'UPDATE batches SET remaining_quantity = ? WHERE id = ?',
      [newRemaining, parent.id]
    );

    await connection.commit();
    console.log("[Split Batch] SUCCESS");
    
    // Submit to blockchain for batch split
    await submitTransaction({
      sender: user_id,
      recipient: user_id,
      batch_id: parent.batch_code,
      event_type: 'BATCH_SPLIT',
      data: {
        parent_batch_id,
        parent_batch_code: parent.batch_code,
        splits_count: childBatches.length,
        total_split_quantity: totalSplitNeeded,
        remaining_quantity: newRemaining,
        child_batches: childBatches.map(c => c.batch_code),
        timestamp: new Date().toISOString(),
      },
    });
    
    res.json({ 
      success: true,
      message: "Batch split successfully",
      data: {
        parent_batch_id: parent_batch_id,
        child_batches: childBatches,
        total_split: totalSplitNeeded,
        remaining_in_parent: newRemaining
      }
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("[Split Batch] CRITICAL ERROR:", error);
    console.error("[Split Batch] Error Stack:", error.stack);
    res.status(500).json({ 
      success: false,
      message: "Internal Server Error", 
      error: error.message 
    });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * GET /api/distributor/inventory
 * Get all batches owned by distributor
 * Clean query: Only batches where current_owner_id = user.id AND remaining_quantity > 0
 */
const getMyInventory = async (req, res) => {
  let connection;

  try {
    const userId = req.user.id || req.user.user_id;

    connection = await db.getConnection();

    const [inventory] = await connection.execute(`
      SELECT 
        b.id,
        b.batch_code,
        b.initial_quantity,
        b.remaining_quantity,
        b.harvest_date,
        b.created_at,
        COALESCE(p.title, 'Unknown Product') as product_name,
        COALESCE(u.full_name, 'Unknown') as farmer_name,
        s.name as status_name
      FROM batches b
      LEFT JOIN products p ON b.product_id = p.id
      LEFT JOIN users u ON p.farmer_id = u.id
      LEFT JOIN statuses s ON b.current_status_id = s.id
      WHERE b.current_owner_id = ? 
      AND b.remaining_quantity > 0
      ORDER BY b.created_at DESC
    `, [userId]);

    res.status(200).json({
      success: true,
      message: 'Inventory retrieved successfully',
      data: inventory,
      count: inventory.length,
    });

  } catch (error) {
    console.error("Inventory Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching inventory",
      error: error.message 
    });
  } finally {
    if(connection) connection.release();
  }
};

/**
 * POST /api/distributor/return
 * Return a batch to the farmer (reverse the purchase)
 */
const returnBatch = async (req, res) => {
  let connection;

  try {
    const batch_id = req.body.batch_id;
    const distributor_id = req.user.id || req.user.user_id;

    if (!batch_id) {
      return res.status(400).json({
        success: false,
        message: 'batch_id is required'
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Fetch the batch and lock it
    const [batches] = await connection.execute(
      'SELECT * FROM batches WHERE id = ? FOR UPDATE',
      [batch_id]
    );

    if (batches.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const batch = batches[0];

    // 2. Verify ownership
    if (batch.current_owner_id !== distributor_id) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({
        success: false,
        message: 'You do not own this batch'
      });
    }

    // 3. Get or create "Returned" status
    let returnedStatus = await Status.findByName('Returned');
    if (!returnedStatus) {
      const statusId = uuidv4();
      returnedStatus = await Status.create({
        id: statusId,
        name: 'Returned',
        description: 'Batch has been returned to previous owner'
      });
    }

    // 4. THE FORK LOGIC: Partial Split vs Full Transfer
    if (batch.parent_batch_id) {
      // SCENARIO A: Partial Split - Restore quantity to parent batch
      console.log(`[Return Batch] Partial split return - Restoring to parent batch ${batch.parent_batch_id}`);

      // Fetch parent batch (farmer's batch)
      const [parentBatches] = await connection.execute(
        'SELECT * FROM batches WHERE id = ? FOR UPDATE',
        [batch.parent_batch_id]
      );

      if (parentBatches.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'Parent batch not found'
        });
      }

      const parentBatch = parentBatches[0];
      const quantityToRestore = parseFloat(batch.remaining_quantity) || 0;

      // Find 'Harvested' Status (To revive the parent and make it visible in marketplace)
      const [harvestedStatusRows] = await connection.execute(
        "SELECT id FROM statuses WHERE name = 'Harvested'"
      );
      
      if (harvestedStatusRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(500).json({
          success: false,
          message: 'Harvested status not found'
        });
      }
      
      const harvestedStatusId = harvestedStatusRows[0].id;

      // Restore quantity to parent AND reset status to 'Harvested' (makes it visible in marketplace)
      const newParentQuantity = parseFloat(parentBatch.remaining_quantity) + quantityToRestore;
      await connection.execute(
        'UPDATE batches SET remaining_quantity = ?, current_status_id = ? WHERE id = ?',
        [newParentQuantity, harvestedStatusId, batch.parent_batch_id]
      );

      // Update child batch: set quantity to 0 and status to "Returned"
      await connection.execute(
        'UPDATE batches SET remaining_quantity = 0, current_status_id = ? WHERE id = ?',
        [returnedStatus.id, batch_id]
      );

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: 'Batch returned successfully. Quantity restored to farmer.',
        data: {
          returned_batch_id: batch_id,
          parent_batch_id: batch.parent_batch_id,
          quantity_restored: quantityToRestore,
          new_parent_quantity: newParentQuantity
        }
      });
    } else {
      // SCENARIO B: Full Transfer - Revert ownership to farmer
      console.log(`[Return Batch] Full transfer return - Reverting ownership to farmer`);

      // Get the product to find the original farmer
      const product = await Product.findById(batch.product_id);
      if (!product) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const farmer_id = product.farmer_id;

      // Get "Harvested" status (or keep current if not found)
      const harvestedStatus = await Status.findByName('Harvested');
      const newStatusId = harvestedStatus ? harvestedStatus.id : batch.current_status_id;

      // Revert ownership and status
      await connection.execute(
        'UPDATE batches SET current_owner_id = ?, current_status_id = ? WHERE id = ?',
        [farmer_id, newStatusId, batch_id]
      );

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: 'Batch returned successfully. Ownership reverted to farmer.',
        data: {
          returned_batch_id: batch_id,
          new_owner_id: farmer_id,
          new_status: harvestedStatus ? 'Harvested' : 'Current'
        }
      });
    }

  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('[Return Batch] Error:', error);
    console.error('[Return Batch] Error Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to return batch',
      error: error.message
    });
  }
};

module.exports = {
  getMarketplace,
  buyBatch,
  splitBatch,
  getMyInventory,
  returnBatch,
};
