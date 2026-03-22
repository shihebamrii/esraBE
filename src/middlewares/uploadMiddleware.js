/**
 * Upload Middleware / ميدلوير الرفع
 * هنا نتعاملو مع رفع الملفات باستعمال Multer
 */

const multer = require('multer');
const AppError = require('../utils/AppError');
const config = require('../config');

// أنواع الملفات المسموح بيها
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm'];

/**
 * فلتر الملفات - نتأكدو من النوع
 * @param {string[]} allowedTypes - الأنواع المسموح بيها
 */
const createFileFilter = (allowedTypes) => {
  return (_req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          `نوع الملف مش مسموح: ${file.mimetype}. الأنواع المسموح بيها: ${allowedTypes.join(', ')}`,
          400
        ),
        false
      );
    }
  };
};

/**
 * إعداد Multer للصور
 */
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxPhotoSize,
  },
  fileFilter: createFileFilter(ALLOWED_IMAGE_TYPES),
});

/**
 * إعداد Multer للفيديو
 */
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxVideoSize,
  },
  fileFilter: createFileFilter(ALLOWED_VIDEO_TYPES),
});

/**
 * إعداد Multer للصوت
 */
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxAudioSize,
  },
  fileFilter: createFileFilter(ALLOWED_AUDIO_TYPES),
});

/**
 * إعداد Multer للمحتوى (فيديو + صوت + thumbnail)
 */
const contentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxVideoSize, // أكبر حجم ممكن
  },
  fileFilter: (_req, file, cb) => {
    const allAllowed = [...ALLOWED_VIDEO_TYPES, ...ALLOWED_AUDIO_TYPES, ...ALLOWED_IMAGE_TYPES];
    if (allAllowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(`نوع الملف مش مسموح: ${file.mimetype}`, 400), false);
    }
  },
});

/**
 * ميدلوير للتعامل مع أخطاء Multer
 */
const handleMulterError = (err, _req, _res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('الملف كبير برشا! جرب ملف أصغر.', 400));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new AppError('عدد الملفات أكثر من المسموح!', 400));
    }
    return next(new AppError(`خطأ في رفع الملف: ${err.message}`, 400));
  }
  next(err);
};

// ============================================
// Upload Field Configurations / إعدادات الفيلدز
// ============================================

/**
 * رفع صورة واحدة (high-res)
 */
const singlePhotoUpload = photoUpload.single('photo');

/**
 * رفع صورتين (high-res و low-res)
 */
const photoWithPreviewUpload = photoUpload.fields([
  { name: 'highRes', maxCount: 1 },
  { name: 'lowRes', maxCount: 1 },
]);

/**
 * رفع محتوى مع thumbnail
 */
const contentWithThumbnailUpload = contentUpload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

/**
 * رفع فيديو واحد
 */
const singleVideoUpload = videoUpload.single('video');

/**
 * رفع صوت واحد
 */
const singleAudioUpload = audioUpload.single('audio');

module.exports = {
  photoUpload,
  videoUpload,
  audioUpload,
  contentUpload,
  handleMulterError,
  singlePhotoUpload,
  photoWithPreviewUpload,
  contentWithThumbnailUpload,
  singleVideoUpload,
  singleAudioUpload,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_AUDIO_TYPES,
};
