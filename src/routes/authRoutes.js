/**
 * Auth Routes / راوتز المصادقة
 * هنا نربطو الإندبوينتز بالكونترولرز
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');

const authController = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validateMiddleware');
const { authValidation } = require('../utils/validators');

// Multer configuration for profile picture upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

// ============================================
// Public Routes / راوتز عامة
// ============================================

// تسجيل مستخدم جديد
router.post(
  '/register',
  validate(authValidation.register),
  authController.register
);

// تسجيل الدخول
router.post(
  '/login',
  validate(authValidation.login),
  authController.login
);

// تجديد التوكن
router.post(
  '/refresh-token',
  validate(authValidation.refreshToken),
  authController.refreshToken
);

// طلب إعادة تعيين الباسوورد
router.post(
  '/forgot-password',
  validate(authValidation.forgotPassword),
  authController.forgotPassword
);

// إعادة تعيين الباسوورد
router.post(
  '/reset-password',
  validate(authValidation.resetPassword),
  authController.resetPassword
);

// الحصول على بيانات مستخدم للعامة
router.get('/users/:id', authController.getUser);

// ============================================
// Protected Routes / راوتز محمية
// ============================================

// الحصول على بيانات المستخدم الحالي
router.get('/me', protect, authController.getMe);

// تحديث بيانات المستخدم الحالي
router.put('/me', protect, validate(authValidation.updateMe), authController.updateMe);

// حذف الحساب
router.delete('/me', protect, authController.deleteMe);

// تسجيل الخروج
router.post('/logout', protect, authController.logout);

// رفع صورة البروفايل
router.post('/me/picture', protect, upload.single('profilePicture'), authController.uploadProfilePicture);

module.exports = router;
