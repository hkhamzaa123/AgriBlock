const { Order, OrderItem, Batch, EventType, Event, ProductChainLog, Status } = require('../models');
const { generateOrderNumber } = require('../utils/batchCodeGenerator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

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
    const order = await Order.create({
      id: orderId,
      order_number: orderNumber,
      buyer_id,
      seller_id,
      total_amount: totalAmount,
      is_completed: false,
    });

    // STEP C: Deduct quantities and create order items
    const orderItems = [];
    const soldEventType = await EventType.findByName('Sold');
    const soldStatus = await Status.findByName('Sold');

    for (const item of validatedItems) {
      // Deduct quantity from batch
      const newRemainingQty = parseFloat(item.batch.remaining_quantity) - item.quantity;
      await Batch.update(item.batch_id, {
        remaining_quantity: newRemainingQty,
      });

      // Update status if batch is fully sold
      if (newRemainingQty <= 0 && soldStatus) {
        await Batch.update(item.batch_id, {
          current_status_id: soldStatus.id,
        });
      }

      // Create order item
      const orderItemId = uuidv4();
      const orderItem = await OrderItem.create({
        id: orderItemId,
        order_id: orderId,
        batch_id: item.batch_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      });

      orderItems.push(orderItem);

      // STEP D: Create "Sold" event for this batch
      if (soldEventType) {
        const eventId = uuidv4();
        await Event.create({
          id: eventId,
          event_type_id: soldEventType.id,
          batch_id: item.batch_id,
          actor_user_id: buyer_id,
          location_coords: null,
          blockchain_tx_hash: null,
        });

        // Update product_chain_log
        const logId = uuidv4();
        const statusId = newRemainingQty <= 0 && soldStatus ? soldStatus.id : item.batch.current_status_id;
        await ProductChainLog.create({
          log_id: logId,
          product_id: item.batch.product_id,
          batch_id: item.batch_id,
          event_id: eventId,
          status_id: statusId,
        });
      }
    }

    // Mark order as completed
    await Order.update(orderId, { is_completed: true });

    await connection.commit();

    const finalOrder = await Order.findById(orderId);
    const finalOrderItems = await OrderItem.findByOrderId(orderId);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order: finalOrder,
        items: finalOrderItems,
        total_amount: totalAmount,
        items_count: orderItems.length,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('createOrder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message,
    });
  } finally {
    connection.release();
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

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
};

