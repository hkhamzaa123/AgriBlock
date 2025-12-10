const db = require('../config/db');
const { getBlockchain, checkBlockchainHealth } = require('../utils/blockchainClient');

/**
 * GET /api/admin/pending-users
 * Get all users with is_active = 0 (pending approval)
 */
const getPendingUsers = async (req, res) => {
  let connection;

  try {
    connection = await db.getConnection();

    const [users] = await connection.execute(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.created_at,
        r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 0
      ORDER BY u.created_at DESC
    `);

    res.status(200).json({
      success: true,
      message: 'Pending users retrieved successfully',
      data: users,
      count: users.length,
    });
  } catch (error) {
    console.error('getPendingUsers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending users',
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * POST /api/admin/approve-user
 * Approve a user by setting is_active = 1
 */
const approveUser = async (req, res) => {
  let connection;

  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required',
      });
    }

    connection = await db.getConnection();

    const [result] = await connection.execute(
      'UPDATE users SET is_active = 1 WHERE id = ?',
      [user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'User approved successfully',
    });
  } catch (error) {
    console.error('approveUser error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve user',
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * POST /api/admin/reject-user
 * Reject a user by deleting them from the database
 */
const rejectUser = async (req, res) => {
  let connection;

  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required',
      });
    }

    connection = await db.getConnection();

    const [result] = await connection.execute(
      'DELETE FROM users WHERE id = ?',
      [user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'User rejected and removed successfully',
    });
  } catch (error) {
    console.error('rejectUser error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject user',
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * GET /api/admin/blockchain
 * Get the entire blockchain for admin viewing
 */
const getBlockchainData = async (req, res) => {
  try {
    console.log('[Admin] Fetching blockchain data...');
    
    const blockchainResult = await getBlockchain();

    if (!blockchainResult.success) {
      return res.status(503).json({
        success: false,
        message: 'Blockchain service unavailable',
        error: blockchainResult.error,
        data: {
          blocks: [],
          health: false,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Blockchain retrieved successfully',
      data: {
        blocks: blockchainResult.blocks,
        count: blockchainResult.blocks.length,
        health: true,
      },
    });
  } catch (error) {
    console.error('getBlockchainData error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blockchain',
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/blockchain/health
 * Check blockchain API health status
 */
const getBlockchainHealth = async (req, res) => {
  try {
    const isHealthy = await checkBlockchainHealth();
    
    res.status(200).json({
      success: true,
      data: {
        healthy: isHealthy,
        status: isHealthy ? 'online' : 'offline',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('getBlockchainHealth error:', error);
    res.status(200).json({
      success: true,
      data: {
        healthy: false,
        status: 'offline',
        timestamp: new Date().toISOString(),
        error: error.message,
      },
    });
  }
};

module.exports = {
  getPendingUsers,
  approveUser,
  rejectUser,
  getBlockchainData,
  getBlockchainHealth,
};












