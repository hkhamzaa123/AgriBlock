const express = require('express');
const router = express.Router();
const farmerController = require('../controllers/farmerController');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');

// All routes require authentication
router.use(verifyToken);
router.use(requireRole('FARMER'));

// Product management
router.post('/products', farmerController.createProduct);
router.get('/products', farmerController.getMyProducts);

// Batch management
router.post('/batches', farmerController.createBatch);
router.get('/batches', farmerController.getMyBatches);

// Event logging
router.post('/events', farmerController.logEvent);

module.exports = router;
