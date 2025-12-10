const { User, Role } = require('../models');

/**
 * RBAC Middleware - Check if user has required role(s)
 * Usage: requireRole('FARMER') or requireRole(['FARMER', 'DISTRIBUTOR'])
 */
const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.user_id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Get user with role information
      const user = await User.findById(req.user.user_id);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
        });
      }

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Account is inactive',
        });
      }

      const userRole = user.role_name;
      const normalizedAllowedRoles = allowedRoles.flat().map(r => r.toUpperCase());

      if (!normalizedAllowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role: ${normalizedAllowedRoles.join(' or ')}`,
        });
      }

      // Attach full user object to request
      req.user.full = user;
      next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Authorization check failed',
        error: error.message,
      });
    }
  };
};

/**
 * Check if user owns a resource
 * Usage: requireOwnership('batch', 'batch_id')
 */
const requireOwnership = (resourceType, idParam = 'id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[idParam] || req.body[idParam];
      const userId = req.user.user_id;

      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: `${idParam} is required`,
        });
      }

      let resource;
      const { Batch, Product, Order } = require('../models');

      switch (resourceType.toLowerCase()) {
        case 'batch':
          resource = await Batch.findById(resourceId);
          if (resource && resource.current_owner_id === userId) {
            return next();
          }
          break;

        case 'product':
          resource = await Product.findById(resourceId);
          if (resource && resource.farmer_id === userId) {
            return next();
          }
          break;

        case 'order':
          resource = await Order.findById(resourceId);
          if (resource && (resource.buyer_id === userId || resource.seller_id === userId)) {
            return next();
          }
          break;

        default:
          return res.status(500).json({
            success: false,
            message: 'Invalid resource type for ownership check',
          });
      }

      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource',
      });
    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({
        success: false,
        message: 'Ownership check failed',
        error: error.message,
      });
    }
  };
};

module.exports = {
  requireRole,
  requireOwnership,
};















