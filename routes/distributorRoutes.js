const express = require('express');
const router = express.Router();
const distributorController = require('../controllers/distributorController');
const logisticsController = require('../controllers/logisticsController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// GET /api/distributor/marketplace - Get all available crops for purchase
router.get('/marketplace', distributorController.getMarketplace);

// POST /api/distributor/buy - Purchase a crop batch
router.post('/buy', distributorController.buyBatch);

// POST /api/distributor/ship - Move a batch to IN_TRANSIT
router.post('/ship', logisticsController.shipToShop);

// GET /api/distributor/inventory - Get distributor's purchased inventory
router.get('/inventory', distributorController.getMyInventory);

module.exports = router;

