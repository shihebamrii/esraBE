/**
 * Photo Routes / راوتز الصور العامة
 */

const express = require('express');
const router = express.Router();

const photoController = require('../controllers/photoController');
const { optionalAuth, protect } = require('../middlewares/authMiddleware');
const { validate, validateObjectId } = require('../middlewares/validateMiddleware');
const { photoValidation } = require('../utils/validators');
const { mediaWithPreviewUpload, handleMulterError, singleMediaUpload } = require('../middlewares/uploadMiddleware');

// قائمة الصور
router.get('/', validate(photoValidation.query, 'query'), photoController.getPhotos);

// رفع صورة (للمستخدم العادي، تحتاج موافقة)
router.post('/upload', protect, mediaWithPreviewUpload, handleMulterError, photoController.uploadPhoto);


// الولايات المتوفرة
router.get('/governorates', photoController.getGovernorates);

// أنواع المناظر
router.get('/landscape-types', photoController.getLandscapeTypes);

// قائمة الباكات
router.get('/packs', photoController.getPacks);

// باك واحد
router.get('/packs/:id', validateObjectId('id'), photoController.getPack);

// صورة واحدة
router.get('/:id', validateObjectId('id'), photoController.getPhoto);

// بريفيو الصورة (مجاني مع watermark)
router.get('/:id/preview', validateObjectId('id'), optionalAuth, photoController.getPhotoPreview);

module.exports = router;
