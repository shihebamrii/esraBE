const express = require('express');
const inquiryController = require('../controllers/inquiryController');
const { protect, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * Public Routes / راوتز متاحة للناس الكل
 */
router.post('/', inquiryController.submitInquiry);

module.exports = router;
