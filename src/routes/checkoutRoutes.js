/**
 * Checkout Routes / راوتز الدفع
 */

const express = require('express');
const router = express.Router();

const checkoutController = require('../controllers/checkoutController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { validate, validateObjectId } = require('../middlewares/validateMiddleware');
const { orderValidation } = require('../utils/validators');

// إنشاء طلب (checkout)
router.post('/', protect, validate(orderValidation.checkout), checkoutController.createOrder);

// كل الطلبات (أدمن)
router.get('/admin/orders', protect, authorize('admin'), checkoutController.getAllOrders);

// قائمة طلباتي
router.get('/orders', protect, checkoutController.getMyOrders);

// استبدال كوتا بباك
router.post('/redeem', protect, checkoutController.redeemDownload);

// طلب واحد
router.get('/orders/:id', protect, validateObjectId('id'), checkoutController.getOrder);

// تحميل مشتريات (public using token)
router.get('/orders/:orderId/download/:token', checkoutController.downloadPurchasedItem);

module.exports = router;
