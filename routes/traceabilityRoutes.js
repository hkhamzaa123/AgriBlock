const express = require('express');
const router = express.Router();
const traceabilityController = require('../controllers/traceabilityController');

// Public routes - no authentication required for traceability

// Full traceability (the "Story")
router.get('/batch/:batch_code', traceabilityController.getBatchTraceability);

// Genealogy tree only
router.get('/batch/:batch_code/genealogy', traceabilityController.getGenealogyTree);

// Events timeline only
router.get('/batch/:batch_code/events', traceabilityController.getBatchEvents);

module.exports = router;















