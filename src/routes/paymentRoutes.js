/**
 * Payment Routes / راوتز الدفع
 */

const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/paymentController');
const { protect } = require('../middlewares/authMiddleware');
const { validateObjectId } = require('../middlewares/validateMiddleware');

// Webhook من مزودي الدفع (public - نتحققو من التوقيع داخليا)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

// Mock completion (dev only)
router.get('/mock-complete', paymentController.mockComplete);

// التحقق من حالة الدفع
router.get('/status/:orderId', protect, validateObjectId('orderId'), paymentController.getPaymentStatus);

module.exports = router;
