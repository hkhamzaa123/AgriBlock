const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Create event (generic - can be used by any role)
router.post('/', eventController.createEvent);

// Get events for a batch
router.get('/batch/:batch_id', eventController.getBatchEvents);

// Add attachments
router.post('/:event_id/attachments', eventController.addAttachment);

// Add IoT data
router.post('/:event_id/iot-data', eventController.addIoTData);

module.exports = router;















