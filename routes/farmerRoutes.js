const express = require('express');
const router = express.Router();
const farmerController = require('../controllers/farmerController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// POST /api/farmer/add-batch - Create a new crop batch
router.post('/add-batch', farmerController.createBatch);

// GET /api/farmer/my-batches - Get all batches for the logged-in farmer
router.get('/my-batches', farmerController.getMyBatches);

// POST /api/farmer/log-event - Log a lifecycle event (Chemical or Harvest)
router.post('/log-event', farmerController.logEvent);

module.exports = router;

