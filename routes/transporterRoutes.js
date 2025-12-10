const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const transporterController = require('../controllers/transporterController');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');

// All routes require authentication
router.use(verifyToken);
router.use(requireRole('TRANSPORTER'));

// Job management
router.get('/available-jobs', transporterController.getAvailableJobs);
router.post('/accept-job', transporterController.acceptJob);
router.get('/my-deliveries', transporterController.getMyDeliveries);
router.post('/update-status', transporterController.updateShipmentStatus);

// Create transport events
router.post('/events', eventController.createEvent);

// Add attachments (proof of condition)
router.post('/events/:event_id/attachments', eventController.addAttachment);

// Add IoT data
router.post('/events/:event_id/iot-data', eventController.addIoTData);

module.exports = router;
