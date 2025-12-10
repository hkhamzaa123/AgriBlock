const { Order, OrderItem, Shipment, Event, EventType, Status, ProductChainLog, Batch } = require('../models');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { submitTransaction } = require('../utils/blockchainClient');

/**
 * GET /api/transporter/available-jobs
 * Get all orders that are not completed and not yet assigned to any shipment
 * Debug-friendly with robust LEFT JOINs to prevent data loss
 */
const getAvailableJobs = async (req, res) => {
  let connection;

  try {
    console.log('[Transporter Debug] Checking for available jobs...');
    connection = await db.getConnection();

    // Debug: Check total orders first
    const [allOrders] = await connection.execute('SELECT id, is_completed FROM orders');
    console.log('[Transporter Debug] Total Orders in DB:', allOrders.length);
    console.log('[Transporter Debug] Completed Orders:', allOrders.filter(o => o.is_completed).length);
    console.log('[Transporter Debug] Incomplete Orders:', allOrders.filter(o => !o.is_completed).length);

    // Debug: Check shipments
    const [allShipments] = await connection.execute('SELECT order_id FROM shipments');
    console.log('[Transporter Debug] Total Shipments:', allShipments.length);
    console.log('[Transporter Debug] Assigned Order IDs:', allShipments.map(s => s.order_id));

    // Robust query with LEFT JOINs for everything to prevent data loss
    // Use is_completed = 0 (boolean false) and shipments.id IS NULL
    // Include role information for pickup and dropoff locations
    const query = `
      SELECT 
        o.id, 
        o.order_number, 
        o.total_amount, 
        o.created_at,
        o.buyer_id,
        o.seller_id,
        b.full_name as buyer_name, 
        b.username as buyer_username,
        br.name as buyer_role,
        s.full_name as seller_name, 
        s.username as seller_username,
        sr.name as seller_role,
        COUNT(oi.id) as item_count,
        COALESCE(SUM(oi.quantity), 0) as total_weight
      FROM orders o
      LEFT JOIN shipments sh ON o.id = sh.order_id
      LEFT JOIN users b ON o.buyer_id = b.id
      LEFT JOIN roles br ON b.role_id = br.id
      LEFT JOIN users s ON o.seller_id = s.id
      LEFT JOIN roles sr ON s.role_id = sr.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.is_completed = 0 
        AND sh.id IS NULL
      GROUP BY o.id, o.order_number, o.total_amount, o.created_at, o.buyer_id, o.seller_id,
               b.full_name, b.username, br.name, s.full_name, s.username, sr.name
      ORDER BY o.created_at DESC
    `;

    const [jobs] = await connection.execute(query);
    console.log('[Transporter Debug] Available Jobs Found:', jobs.length);
    
    if (jobs.length > 0) {
      console.log('[Transporter Debug] Sample Job:', {
        order_number: jobs[0].order_number,
        buyer_name: jobs[0].buyer_name,
        seller_name: jobs[0].seller_name,
        item_count: jobs[0].item_count,
        total_weight: jobs[0].total_weight
      });
    }

    connection.release();

    // Format response with pickup and dropoff locations
    const formattedJobs = jobs.map(job => {
      // Format pickup location: Seller Name + " (" + Seller Role + ")"
      const sellerRole = job.seller_role || 'Unknown';
      const sellerName = job.seller_name || job.seller_username || 'Unknown Seller';
      const pickup_location = `${sellerName} (${sellerRole})`;
      
      // Format dropoff location: Buyer Name + " (" + Buyer Role + ")"
      const buyerRole = job.buyer_role || 'Unknown';
      const buyerName = job.buyer_name || job.buyer_username || 'Unknown Buyer';
      const dropoff_location = `${buyerName} (${buyerRole})`;
      
      return {
        id: job.id,
        order_id: job.id,
        order_number: job.order_number,
        total_amount: job.total_amount,
        created_at: job.created_at,
        buyer_id: job.buyer_id,
        seller_id: job.seller_id,
        buyer_name: buyerName,
        buyer_username: job.buyer_username || 'Unknown',
        buyer_role: buyerRole,
        seller_name: sellerName,
        seller_username: job.seller_username || 'Unknown',
        seller_role: sellerRole,
        pickup_location: pickup_location,
        dropoff_location: dropoff_location,
        item_count: parseInt(job.item_count || 0),
        total_weight: parseFloat(job.total_weight || 0)
      };
    });

    res.status(200).json({
      success: true,
      message: 'Available jobs retrieved successfully',
      data: formattedJobs,
      count: formattedJobs.length
    });
  } catch (error) {
    if (connection) connection.release();
    console.error('[Transporter Error]', error);
    console.error('[Transporter Error] Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error fetching jobs',
      error: error.message
    });
  }
};

/**
 * POST /api/transporter/accept-job
 * Accept a job by creating a shipment record and logging events
 */
const acceptJob = async (req, res) => {
  let connection;

  try {
    const { order_id } = req.body;
    const transporter_id = req.user?.id || req.user?.user_id;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'order_id is required'
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Verify order exists and is not completed
    const order = await Order.findById(order_id);
    if (!order) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.is_completed) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Order is already completed'
      });
    }

    // 2. Check if order already has a shipment
    const existingShipments = await Shipment.findByOrderId(order_id);
    if (existingShipments.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Order is already assigned to a transporter'
      });
    }

    // 3. Create shipment
    const shipmentId = uuidv4();
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 3); // Default: 3 days from now

    await connection.execute(
      `INSERT INTO shipments (id, order_id, transporter_id, estimated_delivery)
       VALUES (?, ?, ?, ?)`,
      [shipmentId, order_id, transporter_id, estimatedDelivery]
    );

    // 4. Get order items to find batches
    const orderItems = await OrderItem.findByOrderId(order_id);

    // 5. Get or create "Shipment Assigned" event type
    let shipmentAssignedEventType = await EventType.findByName('Shipment Assigned');
    if (!shipmentAssignedEventType) {
      const eventTypeId = uuidv4();
      shipmentAssignedEventType = await EventType.create({
        id: eventTypeId,
        name: 'Shipment Assigned',
        description: 'Order has been assigned to a transporter for delivery'
      });
    }

    // 6. Get "In Transit" status
    const inTransitStatus = await Status.findByName('In Transit');
    if (!inTransitStatus) {
      await connection.rollback();
      connection.release();
      return res.status(500).json({
        success: false,
        message: 'In Transit status not found in database'
      });
    }

    // 7. Update RETAILER batches (not source batches)
    // Find retailer batches created during checkout (parent_batch_id = source batch_id, owner = buyer)
    for (const item of orderItems) {
      // Find retailer batches that were created from this source batch
      const [retailerBatches] = await connection.execute(
        `SELECT * FROM batches 
         WHERE parent_batch_id = ? 
           AND current_owner_id = ?
         FOR UPDATE`,
        [item.batch_id, order.buyer_id]
      );

      // Update each retailer batch
      for (const retailerBatch of retailerBatches) {
        // Create event for retailer batch
        const eventId = uuidv4();
        await connection.execute(
          `INSERT INTO events (id, event_type_id, batch_id, actor_user_id, location_coords, blockchain_tx_hash)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [eventId, shipmentAssignedEventType.id, retailerBatch.id, transporter_id, null, null]
        );

        // Update retailer batch status from "Pending Delivery" to "In Transit"
        await connection.execute(
          'UPDATE batches SET current_status_id = ? WHERE id = ?',
          [inTransitStatus.id, retailerBatch.id]
        );

        // Log to product_chain_log
        const logId = uuidv4();
        await connection.execute(
          `INSERT INTO product_chain_log (log_id, product_id, batch_id, event_id, status_id)
           VALUES (?, ?, ?, ?, ?)`,
          [logId, retailerBatch.product_id, retailerBatch.id, eventId, inTransitStatus.id]
        );
      }
    }

    await connection.commit();
    connection.release();

    // Submit to blockchain for each batch
    for (const item of orderItems) {
      const [batches] = await db.execute(
        'SELECT batch_code FROM batches WHERE id = ?',
        [item.batch_id]
      );
      if (batches.length > 0) {
        await submitTransaction({
          sender: order.seller_id,
          recipient: transporter_id,
          batch_id: batches[0].batch_code,
          event_type: 'SHIPMENT_ASSIGNED',
          data: {
            shipment_id: shipmentId,
            order_id,
            order_number: order.order_number,
            transporter_id,
            estimated_delivery: estimatedDelivery.toISOString(),
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    const shipment = await Shipment.findById(shipmentId);

    res.status(201).json({
      success: true,
      message: 'Job accepted successfully',
      data: {
        shipment,
        order,
        batches_updated: orderItems.length
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('[Accept Job] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept job',
      error: error.message
    });
  }
};

/**
 * POST /api/transporter/update-status
 * Update shipment status and log events for all batches
 */
const updateShipmentStatus = async (req, res) => {
  let connection;

  try {
    const { shipment_id, status, location_coords } = req.body;
    const transporter_id = req.user?.id || req.user?.user_id;

    if (!shipment_id || !status) {
      return res.status(400).json({
        success: false,
        message: 'shipment_id and status are required'
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Verify shipment exists and belongs to transporter
    const shipment = await Shipment.findById(shipment_id);
    if (!shipment) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      });
    }

    if (shipment.transporter_id !== transporter_id) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this shipment'
      });
    }

    // 2. Get order and order items
    const order = await Order.findById(shipment.order_id);
    if (!order) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const orderItems = await OrderItem.findByOrderId(order.id);

    // 3. Map status to event type and status
    const statusMap = {
      'Picked Up': { eventType: 'Picked Up', statusName: 'In Transit' },
      'In Transit': { eventType: 'In Transit', statusName: 'In Transit' },
      'Delivered': { eventType: 'Delivered', statusName: 'In Shop' }
    };

    const statusConfig = statusMap[status];
    if (!statusConfig) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${Object.keys(statusMap).join(', ')}`
      });
    }

    // 4. Get or create event type
    let eventType = await EventType.findByName(statusConfig.eventType);
    if (!eventType) {
      const eventTypeId = uuidv4();
      eventType = await EventType.create({
        id: eventTypeId,
        name: statusConfig.eventType,
        description: `Shipment status: ${statusConfig.eventType}`
      });
    }

    // 5. Get status
    const newStatus = await Status.findByName(statusConfig.statusName);
    if (!newStatus) {
      await connection.rollback();
      connection.release();
      return res.status(500).json({
        success: false,
        message: `Status "${statusConfig.statusName}" not found in database`
      });
    }

    // 6. Update retailer batches (not source batches)
    // Find retailer batches created during checkout (parent_batch_id = source batch_id, owner = buyer)
    for (const item of orderItems) {
      // Find retailer batches that were created from this source batch
      const [retailerBatches] = await connection.execute(
        `SELECT * FROM batches 
         WHERE parent_batch_id = ? 
           AND current_owner_id = ?
         FOR UPDATE`,
        [item.batch_id, order.buyer_id]
      );

      // Update each retailer batch
      for (const retailerBatch of retailerBatches) {
        // Create event for retailer batch
        const eventId = uuidv4();
        await connection.execute(
          `INSERT INTO events (id, event_type_id, batch_id, actor_user_id, location_coords, blockchain_tx_hash)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [eventId, eventType.id, retailerBatch.id, transporter_id, location_coords || null, null]
        );

        // Update retailer batch status
        await connection.execute(
          'UPDATE batches SET current_status_id = ? WHERE id = ?',
          [newStatus.id, retailerBatch.id]
        );

        // Log to product_chain_log
        const logId = uuidv4();
        await connection.execute(
          `INSERT INTO product_chain_log (log_id, product_id, batch_id, event_id, status_id)
           VALUES (?, ?, ?, ?, ?)`,
          [logId, retailerBatch.product_id, retailerBatch.id, eventId, newStatus.id]
        );
      }
    }

    // 7. If status is "Delivered", FORCE UPDATE batches to "In Shop" and mark order as completed
    if (status === 'Delivered') {
      // 1. Get 'In Shop' Status ID (find or create)
      let [s] = await connection.execute("SELECT id FROM statuses WHERE name = 'In Shop'");
      if (s.length === 0) {
        const newId = uuidv4();
        await connection.execute("INSERT INTO statuses (id, name, description) VALUES (?, 'In Shop', 'Batch is available in retail shop')", [newId]);
        s = [{ id: newId }];
        console.log('[Transporter] Created "In Shop" status with ID:', newId);
      }
      const inShopId = s[0].id;

      // 2. Get Order ID from Shipment (already have it, but for clarity)
      const orderId = order.id;

      // 3. Get Batch IDs from Order Items
      const [items] = await connection.execute("SELECT batch_id FROM order_items WHERE order_id = ?", [orderId]);

      // 4. BRUTE FORCE LOOP - Update ALL batches related to this order to 'In Shop'
      for (const item of items) {
        // 4a. Update the source batch (order_items.batch_id)
        await connection.execute(
          "UPDATE batches SET current_status_id = ? WHERE id = ?", 
          [inShopId, item.batch_id]
        );
        console.log(`[Transporter] Forced Source Batch ${item.batch_id} to 'In Shop'`);

        // 4b. Also update any CHILD batches (retailer batches created from this source)
        // These are the batches that actually belong to the buyer/retailer
        const [childBatches] = await connection.execute(
          "SELECT id FROM batches WHERE parent_batch_id = ? AND current_owner_id = ?",
          [item.batch_id, order.buyer_id]
        );
        for (const child of childBatches) {
          await connection.execute(
            "UPDATE batches SET current_status_id = ? WHERE id = ?", 
            [inShopId, child.id]
          );
          console.log(`[Transporter] Forced Retailer Batch ${child.id} to 'In Shop'`);
        }
      }

      // 5. Complete Order
      await connection.execute("UPDATE orders SET is_completed = 1 WHERE id = ?", [orderId]);
      console.log(`[Transporter] Marked order ${orderId} as completed`);
    }

    await connection.commit();
    connection.release();

    // Submit to blockchain for each batch
    for (const item of orderItems) {
      const [batches] = await db.execute(
        'SELECT batch_code FROM batches WHERE id = ?',
        [item.batch_id]
      );
      if (batches.length > 0) {
        await submitTransaction({
          sender: transporter_id,
          recipient: status === 'Delivered' ? order.buyer_id : transporter_id,
          batch_id: batches[0].batch_code,
          event_type: status.toUpperCase().replace(/\s+/g, '_'),
          data: {
            shipment_id,
            order_id: order.id,
            status,
            location_coords: location_coords || null,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Shipment status updated to "${status}"`,
      data: {
        shipment_id,
        status,
        order_completed: status === 'Delivered',
        batches_updated: orderItems.length
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('[Update Status] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update shipment status',
      error: error.message
    });
  }
};

/**
 * GET /api/transporter/my-deliveries
 * Get all shipments assigned to the current transporter
 */
const getMyDeliveries = async (req, res) => {
  try {
    const transporter_id = req.user?.id || req.user?.user_id;

    // Get shipments with order details
    const [shipments] = await db.execute(
      `SELECT s.*, 
              o.order_number, o.buyer_id, o.seller_id, o.is_completed,
              buyer.username as buyer_username, buyer.full_name as buyer_name,
              seller.username as seller_username, seller.full_name as seller_name
       FROM shipments s
       LEFT JOIN orders o ON s.order_id = o.id
       LEFT JOIN users buyer ON o.buyer_id = buyer.id
       LEFT JOIN users seller ON o.seller_id = seller.id
       WHERE s.transporter_id = ?
       ORDER BY s.created_at DESC`,
      [transporter_id]
    );

    // Enrich with order items
    const enrichedShipments = await Promise.all(
      shipments.map(async (shipment) => {
        const items = await OrderItem.findByOrderId(shipment.order_id);
        const totalWeight = items.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
        
        return {
          ...shipment,
          items,
          total_weight: totalWeight,
          items_count: items.length
        };
      })
    );

    res.status(200).json({
      success: true,
      message: 'Deliveries retrieved successfully',
      data: enrichedShipments,
      count: enrichedShipments.length
    });
  } catch (error) {
    console.error('[My Deliveries] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deliveries',
      error: error.message
    });
  }
};

module.exports = {
  getAvailableJobs,
  acceptJob,
  updateShipmentStatus,
  getMyDeliveries
};

