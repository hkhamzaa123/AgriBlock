const express = require('express');
const router = express.Router();
const distributorController = require('../controllers/distributorController');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');

// All routes require authentication
router.use(verifyToken);
router.use(requireRole('DISTRIBUTOR'));

// Marketplace
router.get('/marketplace', distributorController.getMarketplace);

// Purchase
router.post('/buy', distributorController.buyBatch);

// Batch splitting
router.post('/split-batch', distributorController.splitBatch);

// Inventory
router.get('/inventory', distributorController.getMyInventory);

// Return batch
router.post('/return', distributorController.returnBatch);

module.exports = router;
