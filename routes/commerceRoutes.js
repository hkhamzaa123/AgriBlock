const express = require('express');
const router = express.Router();
const commerceController = require('../controllers/commerceController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Order management (available to all authenticated users)
router.post('/orders', commerceController.createOrder);
router.get('/orders', commerceController.getMyOrders);
router.get('/orders/:order_id', commerceController.getOrderById);

module.exports = router;

