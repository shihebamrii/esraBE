/**
 * Media Routes / راوتز الميديا
 * هنا نربطو إندبوينتز streaming والتحميل
 */

const express = require('express');
const router = express.Router();

const mediaController = require('../controllers/mediaController');
const { optionalAuth } = require('../middlewares/authMiddleware');
const { validateObjectId } = require('../middlewares/validateMiddleware');

// ============================================
// Public Routes / راوتز عامة
// ============================================

// Streaming مع Range support
router.get('/:fileId', validateObjectId('fileId'), mediaController.streamMedia);

// تحميل الملف
router.get('/:fileId/download', validateObjectId('fileId'), optionalAuth, mediaController.downloadMedia);

// معلومات الملف
router.get('/:fileId/info', validateObjectId('fileId'), mediaController.getMediaInfo);

// تسجيل المشاهدات
router.post('/views/:contentId', validateObjectId('contentId'), optionalAuth, mediaController.trackView);

module.exports = router;
