/**
 * Admin Routes / راوتز الأدمن
 * هنا نربطو إندبوينتز الإدارة
 */

const express = require('express');
const router = express.Router();

const adminContentController = require('../controllers/adminContentController');
const adminPhotoController = require('../controllers/adminPhotoController');
const adminUserController = require('../controllers/adminUserController');
const adminPlaylistController = require('../controllers/adminPlaylistController');
const packController = require('../controllers/packController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { contentWithThumbnailUpload, photoWithPreviewUpload, singlePhotoUpload, handleMulterError } = require('../middlewares/uploadMiddleware');
const { validate, validateObjectId } = require('../middlewares/validateMiddleware');
const { contentValidation, photoValidation, packValidation } = require('../utils/validators');

/**
 * ميدلوير لفك الـ JSON من الـ FormData
 * نحتاجوه خاطر Multer ما يفكش الـ JSON في الـ body
 */
const parseJsonFields = (fields) => (req, res, next) => {
  fields.forEach(field => {
    if (req.body && req.body[field] && typeof req.body[field] === 'string') {
      try {
        req.body[field] = JSON.parse(req.body[field]);
      } catch (e) {
        // لو مش JSON صحيح نخليوه والـ validator هو الي يحكم
      }
    }
  });
  next();
};

// كل الراوتز محمية ولازم admin
router.use(protect);

// ============================================
// Content Routes / راوتز المحتوى
// ============================================

// رفع محتوى جديد (admin)
router.post(
  '/content/upload',
  authorize('admin'),
  contentWithThumbnailUpload,
  handleMulterError,
  parseJsonFields(['authors', 'themes', 'tags', 'metadata']),
  adminContentController.uploadContent
);

// قائمة المحتويات (admin برك)
router.get(
  '/content',
  authorize('admin'),
  validate(contentValidation.query, 'query'),
  adminContentController.getAllContent
);

// تحديث محتوى
router.put(
  '/content/:id',
  authorize('admin'),
  contentWithThumbnailUpload,
  handleMulterError,
  parseJsonFields(['authors', 'themes', 'tags', 'metadata']),
  validateObjectId('id'),
  validate(contentValidation.update),
  adminContentController.updateContent
);

// الموافقة على محتوى (Admin)
router.put(
  '/content/:id/approve',
  authorize('admin'),
  validateObjectId('id'),
  adminContentController.approveContent
);

// حذف محتوى (admin برك)
router.delete(
  '/content/:id',
  authorize('admin'),
  validateObjectId('id'),
  adminContentController.deleteContent
);

// ============================================
// Photo Routes / راوتز الصور
// ============================================

// رفع صورة جديدة
router.post(
  '/photos/upload',
  authorize('admin'),
  photoWithPreviewUpload,
  handleMulterError,
  parseJsonFields(['tags']),
  adminPhotoController.uploadPhoto
);

// رفع صورة واحدة (shortcut)
router.post(
  '/photos/upload-single',
  authorize('admin'),
  singlePhotoUpload,
  handleMulterError,
  parseJsonFields(['tags']),
  adminPhotoController.uploadPhoto
);

// قائمة الصور
router.get(
  '/photos',
  authorize('admin'),
  validate(photoValidation.query, 'query'),
  adminPhotoController.getAllPhotos
);

// تحديث صورة
router.put(
  '/photos/:id',
  authorize('admin'),
  photoWithPreviewUpload,
  handleMulterError,
  parseJsonFields(['tags']),
  validateObjectId('id'),
  validate(photoValidation.update),
  adminPhotoController.updatePhoto
);

// الموافقة على صورة (Admin)
router.put(
  '/photos/:id/approve',
  authorize('admin'),
  validateObjectId('id'),
  adminPhotoController.approvePhoto
);

// حذف صورة
router.delete(
  '/photos/:id',
  authorize('admin'),
  validateObjectId('id'),
  adminPhotoController.deletePhoto
);

// ============================================
// Pack Routes / راوتز الباكات
// ============================================

// إنشاء باك
router.post(
  '/packs',
  authorize('admin'),
  validate(packValidation.create),
  packController.createPack
);

// قائمة الباكات
router.get(
  '/packs',
  authorize('admin'),
  packController.getAllPacks
);

// تحديث باك
router.put(
  '/packs/:id',
  authorize('admin'),
  validateObjectId('id'),
  validate(packValidation.update),
  packController.updatePack
);

// حذف باك
router.delete(
  '/packs/:id',
  authorize('admin'),
  validateObjectId('id'),
  packController.deletePack
);

// ============================================
// User Routes / راوتز المستخدمين
// ============================================

// قائمة المستخدمين مع الباكات
router.get(
  '/users',
  authorize('admin'),
  adminUserController.getAllUsers
);

// تحديث كوتا المستخدم
router.put(
  '/users/:userId/packs/:userPackId',
  authorize('admin'),
  validateObjectId('userId'),
  validateObjectId('userPackId'),
  adminUserController.updateUserPackQuota
);

// تحديث حالة المستخدم
router.put(
  '/users/:id/status',
  authorize('admin'),
  validateObjectId('id'),
  adminUserController.updateUserStatus
);

// ============================================
// Playlist Routes / راوتز قوائم التشغيل
// ============================================

// قائمة قوائم التشغيل
router.get(
  '/playlists',
  authorize('admin'),
  adminPlaylistController.getAllPlaylists
);

// إنشاء قائمة تشغيل
router.post(
  '/playlists',
  authorize('admin'),
  adminPlaylistController.createPlaylist
);

// تحديث قائمة تشغيل
router.put(
  '/playlists/:id',
  authorize('admin'),
  validateObjectId('id'),
  adminPlaylistController.updatePlaylist
);

// حذف قائمة تشغيل
router.delete(
  '/playlists/:id',
  authorize('admin'),
  validateObjectId('id'),
  adminPlaylistController.deletePlaylist
);

module.exports = router;
