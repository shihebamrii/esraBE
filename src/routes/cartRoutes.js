/**
 * Cart Routes / راوتز السلة
 */

const express = require('express');
const router = express.Router();

const cartController = require('../controllers/cartController');
const { protect } = require('../middlewares/authMiddleware');
const { validate, validateObjectId } = require('../middlewares/validateMiddleware');
const { cartValidation } = require('../utils/validators');

// كل راوتز السلة محمية
router.use(protect);

// الحصول على السلة
router.get('/', cartController.getCart);

// إضافة للسلة
router.post('/', validate(cartValidation.addItem), cartController.addToCart);

// تحديث الأسعار
router.post('/refresh', cartController.refreshCart);

// تفريغ السلة
router.delete('/', cartController.clearCart);

// حذف عنصر
router.delete('/:itemId', cartController.removeFromCart);

module.exports = router;
