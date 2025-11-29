const express = require('express');
const router = express.Router();
const logisticsController = require('../controllers/logisticsController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// GET /api/shop/inventory - List all batches available in shop
router.get('/inventory', logisticsController.getShopInventory);

// POST /api/shop/sell - Mark batch as sold to consumer
router.post('/sell', logisticsController.sellToConsumer);

module.exports = router;





