const { Batch, Product, Status, Event, EventType } = require('../models');
const { generateBatchCode } = require('../utils/batchCodeGenerator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { getTransactionsByBatchId, getTransactionsByBatchIds } = require('../utils/blockchainClient');

/**
 * GET /api/consumer/marketplace
 * Get all batches available for purchase (status: "In Shop", remaining_quantity > 0, owner is Retailer/Shopkeeper)
 */
const getMarketplace = async (req, res) => {
  try {
    const query = `
      SELECT 
        b.id,
        b.batch_code,
        b.initial_quantity,
        b.remaining_quantity,
        b.quantity_unit,
        b.harvest_date,
        b.created_at,
        p.id as product_id,
        p.title as product_title,
        p.crop_details,
        u.id as shopkeeper_id,
        u.username as shopkeeper_username,
        u.full_name as shopkeeper_name,
        s.name as status_name,
        r.name as owner_role
      FROM batches b
      LEFT JOIN products p ON b.product_id = p.id
      LEFT JOIN users u ON b.current_owner_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN statuses s ON b.current_status_id = s.id
      WHERE s.name = 'In Shop'
        AND b.remaining_quantity > 0
        AND (r.name = 'RETAILER' OR r.name = 'SHOPKEEPER')
      ORDER BY b.created_at DESC
    `;

    const [batches] = await db.execute(query);

    // Calculate retail price (Base price * 1.5 markup)
    // Since we don't have a price column, we'll use a base price of $10/kg
    const BASE_PRICE = 10.0;
    const MARKUP = 1.5;
    const RETAIL_PRICE = BASE_PRICE * MARKUP;

    const marketplace = batches.map(batch => ({
      id: batch.id,
      batch_code: batch.batch_code,
      product: {
        id: batch.product_id,
        title: batch.product_title,
        crop_details: batch.crop_details,
      },
      shopkeeper: {
        id: batch.shopkeeper_id,
        username: batch.shopkeeper_username,
        name: batch.shopkeeper_name,
      },
      available_quantity: parseFloat(batch.remaining_quantity),
      quantity_unit: batch.quantity_unit || 'kg',
      price_per_unit: RETAIL_PRICE,
      total_price: parseFloat(batch.remaining_quantity) * RETAIL_PRICE,
      harvest_date: batch.harvest_date,
      status: batch.status_name,
    }));

    res.status(200).json({
      success: true,
      message: 'Marketplace retrieved successfully',
      data: marketplace,
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
 * POST /api/consumer/buy
 * Consumer purchases a quantity from a retailer batch
 * Creates a new batch for the consumer with partial split logic
 */
const buyBatch = async (req, res) => {
  let connection;

  try {
    const { batch_id, quantity } = req.body;
    const buyer_id = req.user.id || req.user.user_id;

    console.log(`[Consumer] Buying ${quantity} of Batch ${batch_id}`);

    if (!batch_id || !quantity) {
      return res.status(400).json({ success: false, message: 'Missing data' });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Validate Stock (Lock the row)
    const [parents] = await connection.execute(
      'SELECT * FROM batches WHERE id = ? FOR UPDATE',
      [batch_id]
    );

    if (parents.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const parent = parents[0];
    console.log(`[Consumer] Parent Batch Found. Available: ${parent.remaining_quantity}`);

    if (Number(parent.remaining_quantity) < Number(quantity)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Not enough stock' });
    }

    // 2. Get/Create 'Consumed' Status
    let [s] = await connection.execute(
      "SELECT id FROM statuses WHERE name = 'Consumed'"
    );
    if (s.length === 0) {
      const newId = uuidv4();
      await connection.execute(
        "INSERT INTO statuses (id, name) VALUES (?, 'Consumed')",
        [newId]
      );
      s = [{ id: newId }];
      console.log("[Consumer] Created 'Consumed' status");
    }
    const consumedId = s[0].id;
    console.log('[Consumer] Using Consumed Status ID:', consumedId);

    // 3. Update Retailer Stock
    const newRem = Number(parent.remaining_quantity) - Number(quantity);
    await connection.execute('UPDATE batches SET remaining_quantity = ? WHERE id = ?', [
      newRem,
      parent.id,
    ]);
    console.log('[Consumer] Updated retailer batch remaining_quantity to:', newRem);

    // 4. Create Consumer Batch
    const newId = uuidv4();
    const newCode = `${parent.batch_code}-C${Math.floor(Math.random() * 1000)}`;

    await connection.execute(
      `
        INSERT INTO batches (id, product_id, parent_batch_id, batch_code, current_owner_id, current_status_id, initial_quantity, remaining_quantity, quantity_unit, harvest_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        newId,
        parent.product_id,
        parent.id,
        newCode,
        buyer_id,
        consumedId,
        quantity,
        quantity,
        parent.quantity_unit,
        parent.harvest_date,
      ]
    );
    console.log('[Consumer] Created consumer batch with ID:', newId);

    // 5. Create Traceability Event (Sold to Consumer)
    const eventId = uuidv4();

    // Get Event Type 'Sold'
    let [et] = await connection.execute(
      "SELECT id FROM event_types WHERE name = 'Sold'"
    );
    let eventTypeId = et.length > 0 ? et[0].id : null;

    if (!eventTypeId) {
      const newEtId = uuidv4();
      await connection.execute(
        "INSERT INTO event_types (id, name) VALUES (?, 'Sold')",
        [newEtId]
      );
      eventTypeId = newEtId;
      console.log("[Consumer] Created 'Sold' event type");
    }

    await connection.execute(
      `
        INSERT INTO events (id, event_type_id, batch_id, actor_user_id, recorded_at)
        VALUES (?, ?, ?, ?, NOW())
      `,
      [eventId, eventTypeId, parent.id, buyer_id] // Log on parent as the sale event
    );
    console.log('[Consumer] Logged Sold event with ID:', eventId);

    await connection.commit();
    console.log(`[Consumer] Buy Successful! New Batch ID: ${newId}`);

    // Keep response shape consistent for frontend (expects success flag)
    res.status(201).json({ success: true, message: 'Purchase successful' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[Consumer Buy Error]', error);
    res.status(500).json({ success: false, message: 'Buy Failed', error: error.message });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * GET /api/consumer/my-orders
 * Get all batches owned by the consumer with safe history lookup
 * Performance-safe: Limits recursion depth and uses try/catch per batch
 */
const getMyOrders = async (req, res) => {
  let connection;

  try {
    const userId = req.user.id || req.user.user_id;

    connection = await db.getConnection();

    console.log(`[Consumer] Fetching orders for User: ${userId}`);

    // 1. Get Basic List (Fast)
    const [myBatches] = await connection.execute(`
      SELECT 
        b.id,
        b.batch_code,
        b.initial_quantity,
        b.remaining_quantity,
        b.quantity_unit,
        b.harvest_date,
        b.created_at,
        b.parent_batch_id,
        p.id as product_id,
        COALESCE(p.title, 'Unknown Product') as product_name,
        p.crop_details,
        s.name as status_name
      FROM batches b
      LEFT JOIN products p ON b.product_id = p.id
      LEFT JOIN statuses s ON b.current_status_id = s.id
      WHERE b.current_owner_id = ?
      ORDER BY b.created_at DESC
    `, [userId]);

    console.log(`[Consumer] Found ${myBatches.length} batches. Enriching history...`);

    // 2. Enrich with History (Safe Mode)
    const enrichedBatches = await Promise.all(
      myBatches.map(async (batch) => {
        let history = [];
        let lifecycleStages = {
          farmer: null,
          distributor: null,
          transporter: null,
          retailer: null,
        };

        let currId = batch.id;
        let depth = 0;
        const MAX_DEPTH = 6; // Stop infinite loops
        const visitedBatches = new Set();

        try {
          while (currId && depth < MAX_DEPTH && !visitedBatches.has(currId)) {
            visitedBatches.add(currId);

            // Fetch events for this batch
            const [events] = await connection.execute(`
              SELECT 
                e.recorded_at, 
                et.name as event_type, 
                COALESCE(u.full_name, u.username, 'Unknown') as actor, 
                r.name as role
              FROM events e
              LEFT JOIN event_types et ON e.event_type_id = et.id
              LEFT JOIN users u ON e.actor_user_id = u.id
              LEFT JOIN roles r ON u.role_id = r.id
              WHERE e.batch_id = ?
              ORDER BY e.recorded_at DESC
            `, [currId]);

            if (events.length > 0) {
              history.push(...events);
            }

            // Get batch owner info for lifecycle stages
            const [batchInfo] = await connection.execute(`
              SELECT 
                b.current_owner_id,
                b.harvest_date,
                b.created_at,
                b.batch_code,
                u.full_name,
                r.name as role_name
              FROM batches b
              LEFT JOIN users u ON b.current_owner_id = u.id
              LEFT JOIN roles r ON u.role_id = r.id
              WHERE b.id = ?
            `, [currId]);

            if (batchInfo.length > 0) {
              const info = batchInfo[0];
              const role = info.role_name?.toUpperCase();
              const ownerName = info.full_name;

              if (role === 'FARMER' && !lifecycleStages.farmer) {
                lifecycleStages.farmer = {
                  name: ownerName,
                  batch_code: info.batch_code,
                  harvest_date: info.harvest_date,
                };
              } else if (role === 'DISTRIBUTOR' && !lifecycleStages.distributor) {
                lifecycleStages.distributor = {
                  name: ownerName,
                  batch_code: info.batch_code,
                  created_at: info.created_at,
                };
              } else if (role === 'TRANSPORTER' && !lifecycleStages.transporter) {
                lifecycleStages.transporter = {
                  name: ownerName,
                };
              } else if (role === 'RETAILER' && !lifecycleStages.retailer) {
                lifecycleStages.retailer = {
                  name: ownerName,
                  batch_code: info.batch_code,
                  created_at: info.created_at,
                };
              }
            }

            // Climb up to parent
            const [parents] = await connection.execute(
              'SELECT parent_batch_id FROM batches WHERE id = ?',
              [currId]
            );

            if (parents.length > 0 && parents[0].parent_batch_id) {
              currId = parents[0].parent_batch_id;
              depth++;
            } else {
              currId = null; // End of chain
            }
          }
        } catch (err) {
          console.error(`[Consumer] History Error Batch ${batch.id}:`, err.message);
          // Don't crash, just return partial history
        }

        return {
          id: batch.id,
          batch_code: batch.batch_code,
          product: {
            id: batch.product_id,
            title: batch.product_name,
            crop_details: batch.crop_details,
          },
          quantity: parseFloat(batch.remaining_quantity) || 0,
          quantity_unit: batch.quantity_unit || 'kg',
          harvest_date: batch.harvest_date,
          created_at: batch.created_at,
          status: batch.status_name,
          lifecycle_stages: lifecycleStages,
          history: history,
          total_events: history.length,
        };
      })
    );

    res.status(200).json({
      success: true,
      message: 'Orders retrieved successfully',
      data: enrichedBatches,
    });
  } catch (error) {
    console.error("[Consumer Error]", error);
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * GET /api/consumer/blockchain/:batch_code
 * Get blockchain transactions for a specific batch
 */
const getBlockchainForBatch = async (req, res) => {
  try {
    const { batch_code } = req.params;
    const consumer_id = req.user.id || req.user.user_id;

    if (!batch_code) {
      return res.status(400).json({
        success: false,
        message: 'batch_code is required',
      });
    }

    // Verify consumer owns this batch
    const [batches] = await db.execute(
      'SELECT * FROM batches WHERE batch_code = ? AND current_owner_id = ?',
      [batch_code, consumer_id]
    );

    if (batches.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not own this batch or batch not found',
      });
    }

    console.log(`[Consumer] Fetching blockchain for batch: ${batch_code}`);
    
    const blockchainResult = await getTransactionsByBatchId(batch_code);

    if (!blockchainResult.success) {
      return res.status(503).json({
        success: false,
        message: 'Blockchain service unavailable',
        error: blockchainResult.error,
        data: {
          batch_code,
          transactions: [],
        },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Blockchain data retrieved successfully',
      data: {
        batch_code,
        batch_info: batches[0],
        transactions: blockchainResult.transactions,
        count: blockchainResult.count,
      },
    });
  } catch (error) {
    console.error('getBlockchainForBatch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blockchain data',
      error: error.message,
    });
  }
};

/**
 * GET /api/consumer/my-blockchain
 * Get blockchain transactions for all batches owned by consumer
 */
const getMyBlockchainData = async (req, res) => {
  try {
    const consumer_id = req.user.id || req.user.user_id;

    // Get all batches owned by consumer
    const [batches] = await db.execute(
      'SELECT id, batch_code, product_id FROM batches WHERE current_owner_id = ?',
      [consumer_id]
    );

    if (batches.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No batches found',
        data: {
          batches: [],
          transactions: {},
        },
      });
    }

    const batchCodes = batches.map(b => b.batch_code);
    console.log(`[Consumer] Fetching blockchain for ${batchCodes.length} batches`);
    
    const blockchainResult = await getTransactionsByBatchIds(batchCodes);

    res.status(200).json({
      success: true,
      message: 'Blockchain data retrieved successfully',
      data: {
        batches,
        transactions: blockchainResult.transactions,
        blockchain_available: blockchainResult.success,
      },
    });
  } catch (error) {
    console.error('getMyBlockchainData error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blockchain data',
      error: error.message,
    });
  }
};

module.exports = {
  getMarketplace,
  buyBatch,
  getMyOrders,
  getBlockchainForBatch,
  getMyBlockchainData,
};

