const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * GET /api/distributor/marketplace
 */
const getMarketplace = async (req, res) => {
  try {
    const sql = `
      SELECT cb.batch_id,
             cb.crop_name,
             cb.variety,
             cb.quantity,
             cb.price_per_kg,
             cb.harvest_date,
             u.username AS farmer_name
      FROM crop_batches cb
      LEFT JOIN users u ON cb.farmer_id = u.user_id
      WHERE cb.status = 'HARVESTED'
      ORDER BY cb.created_at DESC
    `;

    const [rows] = await db.query(sql);

    const sanitizedRows = rows.map((row) => ({
      batch_id: row.batch_id || 'UNKNOWN_BATCH',
      crop_name: row.crop_name || 'Unknown Crop',
      variety: row.variety || 'Unknown Variety',
      quantity: row.quantity == null ? 0 : Number(row.quantity),
      price_per_kg: row.price_per_kg == null ? 0 : Number(row.price_per_kg),
      harvest_date: row.harvest_date || null,
      farmer_name: row.farmer_name || 'Unknown',
    }));

    return res.status(200).json({
      success: true,
      message: 'Marketplace retrieved successfully',
      data: sanitizedRows,
      count: sanitizedRows.length,
    });
  } catch (error) {
    console.error('MARKETPLACE ERROR:', error);
    return res.status(500).json({
      message: 'Server Error',
      error: error.message,
      stack: error.stack,
    });
  }
};

/**
 * POST /api/distributor/buy
 * Simple buy logic with partial splitting (defensive defaults)
 */
const buyBatch = async (req, res) => {
  const { batch_id, quantity_to_buy } = req.body;
  const distributor_id = req.user.user_id;

  if (!batch_id || !quantity_to_buy) {
    return res.status(400).json({
      success: false,
      message: 'batch_id and quantity_to_buy are required',
    });
  }

  const requestedQty = parseFloat(quantity_to_buy);
  if (Number.isNaN(requestedQty) || requestedQty <= 0) {
    return res.status(400).json({
      success: false,
      message: 'quantity_to_buy must be a number greater than zero',
    });
  }

  const PRICE_PER_KG = 10;
  const totalCost = PRICE_PER_KG * requestedQty;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [batchRows] = await connection.query(
      `SELECT batch_id, farmer_id, quantity, status, current_holder_id,
              crop_name, variety, planting_date, harvest_date, price_per_kg
         FROM crop_batches
        WHERE batch_id = ? FOR UPDATE`,
      [batch_id]
    );

    if (batchRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const batch = batchRows[0];
    const availableQty = parseFloat(batch.quantity) || 0;

    if (batch.status !== 'HARVESTED') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: 'Batch must be HARVESTED' });
    }

    if (requestedQty > availableQty) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: `Requested quantity exceeds available supply (${availableQty} kg)`,
      });
    }

    const [walletRows] = await connection.query(
      'SELECT wallet_balance FROM users WHERE user_id = ? FOR UPDATE',
      [distributor_id]
    );

    if (walletRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'Distributor not found' });
    }

    const currentBalance = parseFloat(walletRows[0].wallet_balance) || 0;
    if (currentBalance < totalCost) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: `Insufficient funds (need $${totalCost.toFixed(2)}, have $${currentBalance.toFixed(2)})`,
      });
    }

    const farmer_id = batch.farmer_id;

    await connection.query(
      'UPDATE users SET wallet_balance = wallet_balance - ? WHERE user_id = ?',
      [totalCost, distributor_id]
    );
    await connection.query(
      'UPDATE users SET wallet_balance = wallet_balance + ? WHERE user_id = ?',
      [totalCost, farmer_id]
    );

    const tx_id = uuidv4();
    await connection.query(
      `INSERT INTO transactions (tx_id, batch_id, buyer_id, seller_id, amount, quantity)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tx_id, batch_id, distributor_id, farmer_id, totalCost, requestedQty]
    );

    if (requestedQty >= availableQty) {
      await connection.query(
        `UPDATE crop_batches
            SET current_holder_id = ?, status = 'SOLD_TO_DISTRIBUTOR'
          WHERE batch_id = ?`,
        [distributor_id, batch_id]
      );
    } else {
      await connection.query(
        `UPDATE crop_batches
            SET quantity = ?
          WHERE batch_id = ?`,
        [availableQty - requestedQty, batch_id]
      );

      const newBatchId = uuidv4();
      await connection.query(
        `INSERT INTO crop_batches
           (batch_id, farmer_id, crop_name, variety, quantity, status,
            current_holder_id, planting_date, harvest_date, harvest_machine_type,
            price_per_kg, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'SOLD_TO_DISTRIBUTOR', ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          newBatchId,
          farmer_id,
          batch.crop_name,
          batch.variety,
          requestedQty,
          distributor_id,
          batch.planting_date,
          batch.harvest_date,
          batch.harvest_machine_type || null,
          batch.price_per_kg || PRICE_PER_KG,
        ]
      );
    }

    await connection.commit();
    connection.release();

    res.status(200).json({
      success: true,
      message: 'Purchase successful',
      data: {
        transaction_id: tx_id,
        batch_id,
        quantity_purchased: requestedQty,
        amount_spent: totalCost,
      },
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Buy batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Purchase failed',
      error: error.message,
    });
  }
};

/**
 * GET /api/distributor/inventory
 */
const getMyInventory = async (req, res) => {
  try {
    const distributor_id = req.user.user_id;

    const [rows] = await db.query(
      `SELECT cb.*, u.username AS farmer_name
         FROM crop_batches cb
         JOIN users u ON cb.farmer_id = u.user_id
        WHERE cb.current_holder_id = ?
        ORDER BY cb.created_at DESC`,
      [distributor_id]
    );

    res.status(200).json({
      success: true,
      message: 'Inventory retrieved successfully',
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error('Inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory',
      error: error.message,
    });
  }
};

/**
 * POST /api/distributor/ship
 */
const shipToShop = async (req, res) => {
  try {
    const { batch_id } = req.body;
    const distributor_id = req.user.user_id;

    if (!batch_id) {
      return res.status(400).json({ success: false, message: 'batch_id is required' });
    }

    const [rows] = await db.query(
      `SELECT batch_id, current_holder_id, status
         FROM crop_batches WHERE batch_id = ?`,
      [batch_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const batch = rows[0];

    if (batch.current_holder_id !== distributor_id) {
      return res.status(403).json({ success: false, message: 'You do not own this batch' });
    }

    if (batch.status !== 'SOLD_TO_DISTRIBUTOR') {
      return res.status(400).json({
        success: false,
        message: 'Batch must be SOLD_TO_DISTRIBUTOR before shipping',
      });
    }

    await db.query(
      `UPDATE crop_batches SET status = 'IN_TRANSIT' WHERE batch_id = ?`,
      [batch_id]
    );

    res.status(200).json({
      success: true,
      message: 'Batch shipped successfully; status set to IN_TRANSIT',
    });
  } catch (error) {
    console.error('Ship error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to ship batch',
      error: error.message,
    });
  }
};

module.exports = {
  getMarketplace,
  buyBatch,
  getMyInventory,
  shipToShop,
};
 