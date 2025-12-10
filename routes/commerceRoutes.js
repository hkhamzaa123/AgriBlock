const express = require('express');
const router = express.Router();
const commerceController = require('../controllers/commerceController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Marketplace and inventory for retailers
router.get('/marketplace', commerceController.getRetailerMarketplace);
router.get('/inventory', commerceController.getRetailerInventory);
router.post('/return', commerceController.returnRetailerBatch);

// Order management (available to all authenticated users)
router.post('/orders', commerceController.createOrder);
router.get('/orders', commerceController.getMyOrders);
router.get('/orders/:order_id', commerceController.getOrderById);

module.exports = router;

