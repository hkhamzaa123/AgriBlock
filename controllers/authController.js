const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'agrichain_secret_key_2024';

/**
 * POST /api/auth/login
 */
const login = async (req, res) => {
  console.log('[Auth] Login attempt');

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    const [rows] = await db.execute(
      `SELECT user_id, username, password_hash, role, wallet_balance
         FROM users
        WHERE username = ?`,
      [username]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        wallet_balance: parseFloat(user.wallet_balance),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

/**
 * POST /api/auth/register
 */
const register = async (req, res) => {
  console.log('[Auth] Register attempt');

  try {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Username, password, and role are required',
      });
    }

    const normalizedRole = role.toUpperCase();
    const allowedRoles = ['FARMER', 'DISTRIBUTOR', 'TRANSPORTER', 'SHOPKEEPER', 'CONSUMER'];

    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role supplied',
      });
    }

    const [existing] = await db.execute(
      'SELECT username FROM users WHERE username = ?',
      [username]
    );

    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let walletBalance = 0;
    if (normalizedRole === 'DISTRIBUTOR') walletBalance = 50000;
    if (normalizedRole === 'SHOPKEEPER') walletBalance = 20000;

    const userId = uuidv4();

    await db.execute(
      `INSERT INTO users (user_id, username, password_hash, role, wallet_balance)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, username, hashedPassword, normalizedRole, walletBalance]
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        user_id: userId,
        username,
        role: normalizedRole,
        wallet_balance: walletBalance,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

module.exports = {
  login,
  register,
};




