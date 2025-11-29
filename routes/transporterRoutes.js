const express = require('express');
const router = express.Router();
const logisticsController = require('../controllers/logisticsController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// GET /api/transporter/jobs - List all in-transit shipments
router.get('/jobs', logisticsController.getShipments);

// POST /api/transporter/deliver - Mark shipment as delivered (IN_SHOP)
router.post('/deliver', logisticsController.deliverToShop);

module.exports = router;





