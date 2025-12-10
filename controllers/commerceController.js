const { Order, OrderItem, Batch, EventType, Event, ProductChainLog, Status } = require('../models');
const { generateOrderNumber, generateBatchCode } = require('../utils/batchCodeGenerator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { submitTransaction } = require('../utils/blockchainClient');

/**
 * POST /api/commerce/orders
 * PHASE 4: Create an order (Atomic Transaction)
 * Step A: Check if batches.remaining_quantity >= Requested Quantity for all items
 * Step B: Create the Order
 * Step C: Deduct the quantity from the specific batches immediately
 * Step D: Create a "Sold" event in the events table for those batches
 * Fail Safe: If any step fails, roll back the entire transaction
 */
const createOrder = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { items } = req.body; // items = [{batch_id, quantity, unit_price}, ...]
    const buyer_id = req.user.user_id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'items array is required and must not be empty',
      });
    }

    // STEP A: Validate all batches and check quantities
    const validatedItems = [];
    let totalAmount = 0;
    const batchIds = items.map(item => item.batch_id);

    // Lock all batches for update
    const placeholders = batchIds.map(() => '?').join(',');
    const [batchRows] = await connection.execute(
      `SELECT * FROM batches WHERE id IN (${placeholders}) FOR UPDATE`,
      batchIds
    );

    const batchMap = {};
    batchRows.forEach(batch => {
      batchMap[batch.id] = batch;
    });

    // Validate each item
    for (const item of items) {
      const { batch_id, quantity, unit_price } = item;

      if (!batch_id || !quantity || !unit_price) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Each item must have batch_id, quantity, and unit_price',
        });
      }

      const batch = batchMap[batch_id];
      if (!batch) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: `Batch ${batch_id} not found`,
        });
      }

      const requestedQty = parseFloat(quantity);
      const availableQty = parseFloat(batch.remaining_quantity);

      if (Number.isNaN(requestedQty) || requestedQty <= 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for batch ${batch_id}`,
        });
      }

      if (requestedQty > availableQty) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient quantity for batch ${batch_id}. Available: ${availableQty}, Requested: ${requestedQty}`,
        });
      }

      const itemTotal = requestedQty * parseFloat(unit_price);
      totalAmount += itemTotal;

      validatedItems.push({
        batch_id,
        batch: batch,
        quantity: requestedQty,
        unit_price: parseFloat(unit_price),
        item_total: itemTotal,
      });
    }

    // Get seller_id from first batch (assuming all batches from same seller)
    const seller_id = validatedItems[0].batch.current_owner_id;

    // STEP B: Create the Order
    const orderId = uuidv4();
    const orderNumber = generateOrderNumber();
    await connection.execute(
      `INSERT INTO orders (id, order_number, buyer_id, seller_id, total_amount, is_completed) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, orderNumber, buyer_id, seller_id, totalAmount, false]
    );

    // STEP C: Process items - Deduct quantities, create order items, and create new batches for retailer
    const orderItems = [];
    const retailerBatches = []; // Track batches created for retailer
    const soldEventType = await EventType.findByName('Sold');
    const soldStatus = await Status.findByName('Sold');

    // Get or create "Pending Delivery" status for retailer batches
    let pendingDeliveryStatus = await Status.findByName('Pending Delivery');
    if (!pendingDeliveryStatus) {
      const statusId = uuidv4();
      pendingDeliveryStatus = await Status.create({
        id: statusId,
        name: 'Pending Delivery',
        description: 'Order placed, awaiting transporter pickup'
      });
      console.log('[Create Order] Created "Pending Delivery" status');
    }

    for (const item of validatedItems) {
      const sourceBatch = item.batch;
      const requestedQty = item.quantity;
      const availableQty = parseFloat(sourceBatch.remaining_quantity);

      // Deduct quantity from source batch (distributor's batch)
      const newRemainingQty = availableQty - requestedQty;
      await connection.execute(
        'UPDATE batches SET remaining_quantity = ? WHERE id = ?',
        [newRemainingQty, item.batch_id]
      );

      // Update status if batch is fully sold
      if (newRemainingQty <= 0 && soldStatus) {
        await connection.execute(
          'UPDATE batches SET current_status_id = ? WHERE id = ?',
          [soldStatus.id, item.batch_id]
        );
      }

      // TRACEABILITY: Create NEW BATCH for Retailer (like distributor split logic)
      // Status: "Pending Delivery" - NOT "In Shop" (transporter must deliver it first)
      const newBatchId = uuidv4();
      const newBatchCode = generateBatchCode();
      const retailerStatusId = pendingDeliveryStatus.id;

      await connection.execute(
        `INSERT INTO batches (id, product_id, parent_batch_id, batch_code, current_owner_id, current_status_id, initial_quantity, remaining_quantity, quantity_unit, harvest_date) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newBatchId,
          sourceBatch.product_id,
          item.batch_id, // Link to parent batch (distributor's batch)
          newBatchCode,
          buyer_id, // Retailer becomes owner
          retailerStatusId,
          requestedQty,
          requestedQty, // New batch starts with full quantity
          sourceBatch.quantity_unit || 'kg',
          sourceBatch.harvest_date
        ]
      );

      retailerBatches.push({
        id: newBatchId,
        batch_code: newBatchCode,
        quantity: requestedQty,
        source_batch_id: item.batch_id
      });

      // Create order item (link to SOURCE batch, not the new retailer batch)
      const orderItemId = uuidv4();
      await connection.execute(
        `INSERT INTO order_items (id, order_id, batch_id, quantity, unit_price) 
         VALUES (?, ?, ?, ?, ?)`,
        [orderItemId, orderId, item.batch_id, requestedQty, item.unit_price]
      );

      orderItems.push({
        id: orderItemId,
        order_id: orderId,
        batch_id: item.batch_id,
        quantity: requestedQty,
        unit_price: item.unit_price
      });

      // STEP D: Create "Sold" event for source batch
      if (soldEventType) {
        const eventId = uuidv4();
        await connection.execute(
          `INSERT INTO events (id, event_type_id, batch_id, actor_user_id, location_coords, blockchain_tx_hash) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [eventId, soldEventType.id, item.batch_id, buyer_id, null, null]
        );

        // Update product_chain_log
        const logId = uuidv4();
        const statusId = newRemainingQty <= 0 && soldStatus ? soldStatus.id : sourceBatch.current_status_id;
        await connection.execute(
          `INSERT INTO product_chain_log (log_id, product_id, batch_id, event_id, status_id) 
           VALUES (?, ?, ?, ?, ?)`,
          [logId, sourceBatch.product_id, item.batch_id, eventId, statusId]
        );
      }
    }

    // DO NOT mark order as completed here - only transporter can mark it complete when delivered
    // Order remains incomplete until transporter delivers it

    await connection.commit();
    connection.release();

    // Submit to blockchain for each item in order
    for (const item of validatedItems) {
      await submitTransaction({
        sender: seller_id,
        recipient: buyer_id,
        batch_id: item.batch.batch_code,
        event_type: 'ORDER_CREATED',
        data: {
          order_id: orderId,
          order_number: orderNumber,
          batch_id: item.batch_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          item_total: item.item_total,
          total_amount: totalAmount,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Fetch final order and items (using db pool after transaction)
    const [orderRows] = await db.execute(
      'SELECT * FROM orders WHERE id = ?',
      [orderId]
    );
    const finalOrder = orderRows[0];

    const [itemRows] = await db.execute(
      'SELECT * FROM order_items WHERE order_id = ?',
      [orderId]
    );

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order: finalOrder,
        items: itemRows,
        retailer_batches: retailerBatches, // New batches created for retailer
        total_amount: totalAmount,
        items_count: orderItems.length,
      },
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('createOrder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message,
    });
  }
};

/**
 * GET /api/commerce/orders
 * Get all orders for the current user (as buyer or seller)
 */
const getMyOrders = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    // Get orders as buyer
    const buyerOrders = await Order.findByBuyerId(user_id);
    
    // Get orders as seller
    const sellerOrders = await Order.findBySellerId(user_id);

    // Combine and deduplicate
    const allOrders = [...buyerOrders, ...sellerOrders];
    const uniqueOrders = Array.from(
      new Map(allOrders.map(order => [order.id, order])).values()
    );

    // Enrich with order items
    const enrichedOrders = await Promise.all(
      uniqueOrders.map(async (order) => {
        const items = await OrderItem.findByOrderId(order.id);
        return {
          ...order,
          items,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: 'Orders retrieved successfully',
      data: enrichedOrders,
      count: enrichedOrders.length,
    });
  } catch (error) {
    console.error('getMyOrders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message,
    });
  }
};

/**
 * GET /api/commerce/orders/:order_id
 * Get order details by ID
 */
const getOrderById = async (req, res) => {
  try {
    const { order_id } = req.params;
    const user_id = req.user.user_id;

    const order = await Order.findById(order_id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Verify user has access (buyer or seller)
    if (order.buyer_id !== user_id && order.seller_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this order',
      });
    }

    const items = await OrderItem.findByOrderId(order_id);

    res.status(200).json({
      success: true,
      message: 'Order retrieved successfully',
      data: {
        ...order,
        items,
      },
    });
  } catch (error) {
    console.error('getOrderById error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message,
    });
  }
};

/**
 * GET /api/commerce/marketplace
 * Get batches available for retailers to purchase (from both Farmers and Distributors)
 * Shows batches with status 'Harvested' (Farmers) OR 'In Warehouse' (Distributors)
 * Implements dynamic pricing: Farmers = $13.00/kg, Distributors = $10.00/kg
 */
const getRetailerMarketplace = async (req, res) => {
  let connection;

  try {
    connection = await db.getConnection();

    // Fetch Available Batches (Farmer + Distributor)
    const [batches] = await connection.execute(`
        SELECT 
            b.*, 
            COALESCE(p.title, 'Unknown Product') as product_name,
            COALESCE(p.title, 'Unknown Product') as product_title,
            COALESCE(u.full_name, u.username, 'Unknown Seller') as shopkeeper_name,
            COALESCE(u.full_name, u.username, 'Unknown Seller') as owner_name,
            COALESCE(u.username, 'Unknown') as owner_username,
            r.name as seller_role, 
            s.name as status_name
        FROM batches b
        JOIN users u ON b.current_owner_id = u.id
        JOIN roles r ON u.role_id = r.id
        JOIN products p ON b.product_id = p.id
        LEFT JOIN statuses s ON b.current_status_id = s.id
        WHERE b.remaining_quantity > 0 
        AND b.current_owner_id != ?
        AND (s.name = 'Harvested' OR s.name = 'In Warehouse')
    `, [req.user.id || req.user.user_id]);

    // Apply Dynamic Pricing
    const results = batches.map(b => {
        const isFarmer = (b.seller_role || '').toUpperCase() === 'FARMER';
        return {
            ...b,
            calculated_price: isFarmer ? 13.00 : 10.00, // Expensive vs Standard
            is_premium: isFarmer // Helper flag for UI badge
        };
    });

    res.status(200).json({
      success: true,
      message: 'Marketplace retrieved successfully',
      data: results,
      count: results.length
    });

  } catch (error) {
    console.error("Retailer Market Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching market",
      error: error.message 
    });
  } finally {
    if(connection) connection.release();
  }
};

/**
 * GET /api/commerce/inventory
 * Get batches owned by retailer (all statuses: Pending Delivery, In Transit, In Shop)
 */
const getRetailerInventory = async (req, res) => {
  try {
    const retailer_id = req.user?.id || req.user?.user_id;
    
    // Get all batches owned by retailer (regardless of status)
    // This includes: Pending Delivery, In Transit, and In Shop
    const [rows] = await db.execute(
      `SELECT b.*, 
              p.title as product_title, p.crop_details,
              s.name as status_name
       FROM batches b
       LEFT JOIN products p ON b.product_id = p.id
       LEFT JOIN statuses s ON b.current_status_id = s.id
       WHERE b.current_owner_id = ?
       ORDER BY 
         CASE s.name
           WHEN 'In Shop' THEN 1
           WHEN 'In Transit' THEN 2
           WHEN 'Pending Delivery' THEN 3
           ELSE 4
         END,
         b.created_at DESC`,
      [retailer_id]
    );

    res.status(200).json({
      success: true,
      message: 'Inventory retrieved successfully',
      data: rows,
      count: rows.length
    });
  } catch (error) {
    console.error('[Retailer Inventory] Error:', error);
    console.error('[Retailer Inventory] Error Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory',
      error: error.message,
    });
  }
};

/**
 * POST /api/commerce/return
 * Return a batch to the distributor (reverse the purchase)
 * Retailer items always have a parent_batch_id (they're always splits)
 */
const returnRetailerBatch = async (req, res) => {
  let connection;

  try {
    const batch_id = req.body.batch_id;
    const retailer_id = req.user?.id || req.user?.user_id;

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
    if (batch.current_owner_id !== retailer_id) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({
        success: false,
        message: 'You do not own this batch'
      });
    }

    // 3. Retailer items must have a parent_batch_id (they're always splits)
    if (!batch.parent_batch_id) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'This batch cannot be returned (no parent batch found)'
      });
    }

    // 4. Get or create "Returned" status
    let returnedStatus = await Status.findByName('Returned');
    if (!returnedStatus) {
      const statusId = uuidv4();
      returnedStatus = await Status.create({
        id: statusId,
        name: 'Returned',
        description: 'Batch has been returned to previous owner'
      });
    }

    // 5. Fetch parent batch (distributor's batch) and lock it
    const [parentBatches] = await connection.execute(
      'SELECT * FROM batches WHERE id = ? FOR UPDATE',
      [batch.parent_batch_id]
    );

    if (parentBatches.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Parent batch (distributor batch) not found'
      });
    }

    const parentBatch = parentBatches[0];
    const quantityToRestore = parseFloat(batch.remaining_quantity) || 0;

    // 6. Find 'In Warehouse' Status (To revive the Distributor and make it visible in marketplace)
    const [inWarehouseStatusRows] = await connection.execute(
      "SELECT id FROM statuses WHERE name = 'In Warehouse'"
    );
    
    if (inWarehouseStatusRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(500).json({
        success: false,
        message: 'In Warehouse status not found'
      });
    }
    
    const inWarehouseStatusId = inWarehouseStatusRows[0].id;

    // 7. Restore quantity to parent batch (distributor's batch) AND reset status to 'In Warehouse'
    // This ensures it reappears in the Retailer Marketplace!
    const newParentQuantity = parseFloat(parentBatch.remaining_quantity) + quantityToRestore;
    await connection.execute(
      'UPDATE batches SET remaining_quantity = ?, current_status_id = ? WHERE id = ?',
      [newParentQuantity, inWarehouseStatusId, batch.parent_batch_id]
    );

    // 8. Update retailer batch: set quantity to 0 and status to "Returned"
    await connection.execute(
      'UPDATE batches SET remaining_quantity = 0, current_status_id = ? WHERE id = ?',
      [returnedStatus.id, batch_id]
    );

    await connection.commit();
    connection.release();

    console.log(`[Return Retailer Batch] Success - Restored ${quantityToRestore} to distributor batch ${batch.parent_batch_id}`);

    res.json({
      success: true,
      message: 'Batch returned successfully. Quantity restored to distributor.',
      data: {
        returned_batch_id: batch_id,
        parent_batch_id: batch.parent_batch_id,
        quantity_restored: quantityToRestore,
        new_parent_quantity: newParentQuantity
      }
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('[Return Retailer Batch] Error:', error);
    console.error('[Return Retailer Batch] Error Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to return batch',
      error: error.message
    });
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  getRetailerMarketplace,
  getRetailerInventory,
  returnRetailerBatch,
};

