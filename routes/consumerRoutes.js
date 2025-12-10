const express = require('express');
const router = express.Router();
const consumerController = require('../controllers/consumerController');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');

// All routes require authentication and CONSUMER role
router.use(verifyToken);
router.use(requireRole('CONSUMER'));

// Marketplace - Browse available products
router.get('/marketplace', consumerController.getMarketplace);

// Buy a product
router.post('/buy', consumerController.buyBatch);

// Get my purchases with traceability
router.get('/my-orders', consumerController.getMyOrders);

// Get blockchain data for all owned batches
router.get('/my-blockchain', consumerController.getMyBlockchainData);

// Get blockchain data for specific batch
router.get('/blockchain/:batch_code', consumerController.getBlockchainForBatch);

module.exports = router;

