const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/farmer/batches
 * Creates a new batch; auto-creates a farm profile if needed
 */
const createBatch = async (req, res) => {
  try {
    const { crop_name, variety, planting_date, soil_type, irrigation_source } = req.body;
    const farmer_id = req.user.user_id;

    if (!crop_name || !variety || !planting_date || !soil_type) {
      return res.status(400).json({
        success: false,
        message: 'crop_name, variety, planting_date, and soil_type are required',
      });
    }

    const allowedSoils = ['CLAY', 'SANDY', 'LOAM', 'SILT'];
    const normalizedSoil = soil_type.toUpperCase();

    if (!allowedSoils.includes(normalizedSoil)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid soil_type. Choose CLAY, SANDY, LOAM, or SILT',
      });
    }

    const [farmRows] = await db.execute(
      'SELECT farm_id FROM farm_profiles WHERE farmer_id = ?',
      [farmer_id]
    );

    let farm_id;
    if (!farmRows.length) {
      farm_id = uuidv4();
      await db.execute(
        `INSERT INTO farm_profiles (farm_id, farmer_id, soil_type, irrigation_source, gps_lat, gps_long)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [farm_id, farmer_id, normalizedSoil, irrigation_source || 'Unknown', 0, 0]
      );
    } else {
      farm_id = farmRows[0].farm_id;
    }

    const batch_id = uuidv4();
    await db.execute(
      `INSERT INTO crop_batches (batch_id, farmer_id, crop_name, variety, planting_date, status)
       VALUES (?, ?, ?, ?, ?, 'PLANTED')`,
      [batch_id, farmer_id, crop_name, variety, planting_date]
    );

    res.status(201).json({
      success: true,
      message: 'Crop batch created successfully',
      data: {
        batch_id,
        crop_name,
        variety,
        planting_date,
        status: 'PLANTED',
      },
    });
  } catch (error) {
    console.error('createBatch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create batch',
      error: error.message,
    });
  }
};

/**
 * GET /api/farmer/batches
 */
const getMyBatches = async (req, res) => {
  try {
    const farmer_id = req.user.user_id;

    const [rows] = await db.execute(
      `SELECT batch_id, crop_name, variety, planting_date, harvest_date, status, created_at
         FROM crop_batches
        WHERE farmer_id = ?
        ORDER BY created_at DESC`,
      [farmer_id]
    );

    res.status(200).json({
      success: true,
      message: 'Batches retrieved successfully',
      data: rows,
      count: rows.length,
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
 * POST /api/farmer/batches/:id/events
 */
const logEvent = async (req, res) => {
  try {
    const { batch_id, event_type, data } = req.body;
    const farmer_id = req.user.user_id;

    if (!batch_id || !event_type || !data) {
      return res.status(400).json({
        success: false,
        message: 'batch_id, event_type, and data are required',
      });
    }

    const normalizedEvent = event_type.toUpperCase();
    const [rows] = await db.execute(
      'SELECT farmer_id FROM crop_batches WHERE batch_id = ?',
      [batch_id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    if (rows[0].farmer_id !== farmer_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized for this batch' });
    }

    if (normalizedEvent === 'CHEMICAL') {
      const { chemical_name, quantity, applied_date, notes } = data;
      if (!chemical_name || !applied_date) {
        return res.status(400).json({
          success: false,
          message: 'chemical_name and applied_date are required',
        });
      }

      const log_id = uuidv4();
      await db.execute(
        `INSERT INTO chemical_logs (log_id, batch_id, chemical_name, applied_date, quantity, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [log_id, batch_id, chemical_name, applied_date, quantity || null, notes || null]
      );

      return res.status(200).json({
        success: true,
        message: 'Chemical event logged successfully',
        data: { log_id, batch_id, chemical_name, applied_date },
      });
    }

    if (normalizedEvent === 'HARVEST') {
      const { machine_type, machine_model, yield_qty } = data;
      const parsedYield = parseFloat(yield_qty);

      if (!machine_type || Number.isNaN(parsedYield) || parsedYield <= 0) {
        return res.status(400).json({
          success: false,
          message: 'machine_type and a positive yield_qty are required',
        });
      }

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        const log_id = uuidv4();
        await connection.execute(
          `INSERT INTO harvest_logs (log_id, batch_id, farmer_id, machine_type, machine_model, yield_qty)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [log_id, batch_id, farmer_id, machine_type, machine_model || null, parsedYield]
        );

        const machineDescription = machine_model
          ? `${machine_type} - ${machine_model}`
          : machine_type;

        await connection.execute(
          `UPDATE crop_batches
              SET status = ?,
                  harvest_date = NOW(),
                  harvest_machine_type = ?,
                  quantity = ?
            WHERE batch_id = ?`,
          ['HARVESTED', machineDescription, parsedYield, batch_id]
        );

        await connection.commit();

        return res.status(200).json({
          success: true,
          message: 'Harvest event logged successfully',
          data: {
            batch_id,
            status: 'HARVESTED',
            harvest_date: new Date().toISOString().split('T')[0],
            machine_type: machineDescription,
            yield_qty: parsedYield,
          },
        });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    return res.status(400).json({
      success: false,
      message: 'event_type must be CHEMICAL or HARVEST',
    });
  } catch (error) {
    console.error('logEvent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log event',
      error: error.message,
    });
  }
};

module.exports = {
  createBatch,
  getMyBatches,
  logEvent,
};


