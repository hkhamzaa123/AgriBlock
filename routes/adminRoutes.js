const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');

// All routes require authentication and ADMIN role
router.use(verifyToken);
router.use(requireRole('ADMIN'));

// Get pending users
router.get('/pending-users', adminController.getPendingUsers);

// Approve user
router.post('/approve-user', adminController.approveUser);

// Reject user
router.post('/reject-user', adminController.rejectUser);

// Get blockchain data
router.get('/blockchain', adminController.getBlockchainData);

// Check blockchain health
router.get('/blockchain/health', adminController.getBlockchainHealth);

module.exports = router;












