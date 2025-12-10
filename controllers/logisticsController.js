const db = require('../config/db');

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

    const [rows] = await db.execute(
      `SELECT batch_id, status, current_holder_id
         FROM crop_batches
        WHERE batch_id = ?`,
      [batch_id]
    );

    if (!rows.length) {
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

    await db.execute(
      `UPDATE crop_batches
          SET status = 'IN_TRANSIT'
        WHERE batch_id = ?`,
      [batch_id]
    );

    res.status(200).json({
      success: true,
      message: 'Batch shipped successfully; status set to IN_TRANSIT',
    });
  } catch (error) {
    console.error('shipToShop error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to ship batch',
      error: error.message,
    });
  }
};

/**
 * GET /api/logistics/shipments
 */
const getShipments = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
         cb.batch_id,
         cb.crop_name,
         cb.variety,
         cb.planting_date,
         cb.harvest_date,
         cb.status,
         cb.quantity,
         cb.created_at,
         u.username AS farmer_username,
         d.username AS distributor_username
       FROM crop_batches cb
       JOIN users u ON cb.farmer_id = u.user_id
       LEFT JOIN users d ON cb.current_holder_id = d.user_id
      WHERE cb.status = 'IN_TRANSIT'
      ORDER BY cb.updated_at DESC`
    );

    res.status(200).json({
      success: true,
      message: 'Shipments retrieved successfully',
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error('getShipments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shipments',
      error: error.message,
    });
  }
};

/**
 * POST /api/logistics/deliver
 */
const deliverToShop = async (req, res) => {
  try {
    const { batch_id } = req.body;

    if (!batch_id) {
      return res.status(400).json({ success: false, message: 'batch_id is required' });
    }

    const [rows] = await db.execute(
      `SELECT batch_id, status
         FROM crop_batches
        WHERE batch_id = ?`,
      [batch_id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    if (rows[0].status !== 'IN_TRANSIT') {
      return res.status(400).json({
        success: false,
        message: 'Batch must be IN_TRANSIT to confirm delivery',
      });
    }

    await db.execute(
      `UPDATE crop_batches
          SET status = 'IN_SHOP'
        WHERE batch_id = ?`,
      [batch_id]
    );

    res.status(200).json({
      success: true,
      message: 'Delivery confirmed; status set to IN_SHOP',
    });
  } catch (error) {
    console.error('deliverToShop error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm delivery',
      error: error.message,
    });
  }
};

/**
 * GET /api/logistics/shop-inventory
 */
const getShopInventory = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
         cb.batch_id,
         cb.crop_name,
         cb.variety,
         cb.quantity,
         cb.status,
         cb.harvest_date,
         cb.created_at,
         u.username AS farmer_username
       FROM crop_batches cb
       JOIN users u ON cb.farmer_id = u.user_id
      WHERE cb.status = 'IN_SHOP'
      ORDER BY cb.updated_at DESC`
    );

    res.status(200).json({
      success: true,
      message: 'Shop inventory retrieved successfully',
      data: rows,
      count: rows.length,
    });
  } catch (error) {
    console.error('getShopInventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shop inventory',
      error: error.message,
    });
  }
};

/**
 * POST /api/logistics/sell-to-consumer
 */
const sellToConsumer = async (req, res) => {
  try {
    const { batch_id, final_price } = req.body;

    if (!batch_id) {
      return res.status(400).json({ success: false, message: 'batch_id is required' });
    }

    const [rows] = await db.execute(
      `SELECT batch_id, status
         FROM crop_batches
        WHERE batch_id = ?`,
      [batch_id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    if (rows[0].status !== 'IN_SHOP') {
      return res.status(400).json({
        success: false,
        message: 'Batch must be IN_SHOP to mark as sold',
      });
    }

    await db.execute(
      `UPDATE crop_batches
          SET status = 'SOLD_TO_CONSUMER'
        WHERE batch_id = ?`,
      [batch_id]
    );

    res.status(200).json({
      success: true,
      message: 'Batch sold to consumer successfully',
      data: {
        batch_id,
        final_price: final_price ? parseFloat(final_price) : null,
      },
    });
  } catch (error) {
    console.error('sellToConsumer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark batch as sold',
      error: error.message,
    });
  }
};

module.exports = {
  shipToShop,
  getShipments,
  deliverToShop,
  getShopInventory,
  sellToConsumer,
};



















