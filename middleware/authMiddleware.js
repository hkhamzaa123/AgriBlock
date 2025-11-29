const jwt = require('jsonwebtoken');
const { User } = require('../models');

// JWT Secret (must match the one used in authController)
const JWT_SECRET = process.env.JWT_SECRET || 'agrichain_secret_key_2024';

/**
 * Verify JWT Token Middleware
 * Extracts token from Authorization header, verifies it, and attaches user to req.user
 */
const verifyToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authorization header is required.'
      });
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token not found in Authorization header. Format: Bearer <token>'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Get user from database to ensure they still exist and are active
    const user = await User.findById(decoded.user_id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Attach decoded user to request object
    req.user = {
      user_id: decoded.user_id,
      id: user.id, // Use id from database
      username: decoded.username,
      role: decoded.role || user.role_name
    };

    // Continue to next middleware/controller
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Token verification failed',
      error: error.message
    });
  }
};

module.exports = {
  verifyToken
};





