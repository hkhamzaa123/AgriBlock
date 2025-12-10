const { User, Role } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

    const user = await User.findByUsername(username);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    // Check if account is active AFTER password verification
    if (user.is_active === 0) {
      return res.status(403).json({
        success: false,
        message: 'Account pending Admin approval.',
      });
    }

    const token = jwt.sign(
      { 
        user_id: user.id, 
        username: user.username, 
        role: user.role_name || 'UNKNOWN' 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role_name,
        role_id: user.role_id,
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
    const { username, password, email, full_name, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Username, password, and role are required',
      });
    }

    const normalizedRole = role.toUpperCase();
    const allowedRoles = ['FARMER', 'DISTRIBUTOR', 'TRANSPORTER', 'RETAILER', 'CONSUMER'];

    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed: ${allowedRoles.join(', ')}`,
      });
    }

    // Check if username already exists
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        message: 'Username already exists' 
      });
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await User.findByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ 
          success: false, 
          message: 'Email already exists' 
        });
      }
    }

    // Find role by name
    const roleRecord = await Role.findByName(normalizedRole);
    if (!roleRecord) {
      return res.status(400).json({
        success: false,
        message: 'Role not found in database. Please contact administrator.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { v4: uuidv4 } = require('uuid');
    const userId = uuidv4();

    // New users are pending approval by default (is_active = 0)
    // Exception: If username is 'admin' (from seeder), it's already active
    const isActive = username === 'admin' ? 1 : 0;

    const newUser = await User.create({
      id: userId,
      username,
      email: email || null,
      password_hash: hashedPassword,
      full_name: full_name || null,
      role_id: roleRecord.id,
      is_active: isActive,
    });

    res.status(201).json({
      success: true,
      message: isActive === 1 
        ? 'Account created successfully' 
        : 'Registration successful! Account pending approval.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        full_name: newUser.full_name,
        role: normalizedRole,
        role_id: newUser.role_id,
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




