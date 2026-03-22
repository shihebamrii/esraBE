/**
 * Storage Service / خدمة التخزين
 * هنا نتعاملو مع GridFS ونعملو adapter pattern للـ S3
 */

const mongoose = require('mongoose');
const { Readable } = require('stream');
const { getGridFSBucket } = require('../config/database');
const AppError = require('../utils/AppError');

/**
 * نخزنو ملف في GridFS
 * @param {Buffer} buffer - بيانات الملف
 * @param {string} filename - اسم الملف
 * @param {string} contentType - نوع الملف
 * @param {Object} metadata - ميتاداتا إضافية
 * @returns {Promise<ObjectId>} - معرف الملف
 */
const uploadToGridFS = async (buffer, filename, contentType, metadata = {}) => {
  const bucket = getGridFSBucket();
  
  return new Promise((resolve, reject) => {
    // نحولو البافر لستريم
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);
    
    // نفتحو ستريم الكتابة
    const uploadStream = bucket.openUploadStream(filename, {
      contentType,
      metadata: {
        ...metadata,
        uploadedAt: new Date(),
      },
    });
    
    // نسمعو للأحداث
    uploadStream.on('error', (error) => {
      reject(new AppError(`خطأ في رفع الملف: ${error.message}`, 500));
    });
    
    uploadStream.on('finish', () => {
      resolve(uploadStream.id);
    });
    
    // نبدأو الكتابة
    readableStream.pipe(uploadStream);
  });
};

/**
 * نجيبو ستريم الملف من GridFS
 * @param {ObjectId|string} fileId - معرف الملف
 * @returns {DownloadStream}
 */
const getDownloadStream = (fileId) => {
  const bucket = getGridFSBucket();
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  return bucket.openDownloadStream(objectId);
};

/**
 * نجيبو ستريم جزئي (للـ Range requests)
 * @param {ObjectId|string} fileId - معرف الملف
 * @param {number} start - بداية البايتات
 * @param {number} end - نهاية البايتات
 * @returns {DownloadStream}
 */
const getPartialDownloadStream = (fileId, start, end) => {
  const bucket = getGridFSBucket();
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  return bucket.openDownloadStream(objectId, { start, end: end + 1 });
};

/**
 * نجيبو معلومات الملف
 * @param {ObjectId|string} fileId - معرف الملف
 * @returns {Promise<Object>}
 */
const getFileInfo = async (fileId) => {
  const bucket = getGridFSBucket();
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  
  const files = await bucket.find({ _id: objectId }).toArray();
  
  if (files.length === 0) {
    return null;
  }
  
  return files[0];
};

/**
 * نمسحو ملف من GridFS
 * @param {ObjectId|string} fileId - معرف الملف
 */
const deleteFromGridFS = async (fileId) => {
  const bucket = getGridFSBucket();
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  
  try {
    await bucket.delete(objectId);
  } catch (error) {
    // نتجاهلو الخطأ لو الملف ما موجودش
    if (error.message.includes('File not found')) {
      return;
    }
    throw error;
  }
};

/**
 * نتأكدو من نوع الملف
 * @param {string} contentType - نوع MIME
 * @param {string[]} allowedTypes - الأنواع المسموح بيها
 */
const validateFileType = (contentType, allowedTypes) => {
  if (!allowedTypes.some((type) => contentType.startsWith(type))) {
    throw new AppError(`نوع الملف مش مسموح! الأنواع المسموح بيها: ${allowedTypes.join(', ')}`, 400);
  }
};

// ============================================
// Storage Adapter Interface / واجهة المحول
// ============================================

/**
 * واجهة محول التخزين - نقدرو نبدلوها بـ S3 في المستقبل
 */
class StorageAdapter {
  async upload(_buffer, _filename, _contentType, _metadata) {
    throw new Error('لازم تـ override هالميثود!');
  }
  
  getDownloadStream(_fileId) {
    throw new Error('لازم تـ override هالميثود!');
  }
  
  async getFileInfo(_fileId) {
    throw new Error('لازم تـ override هالميثود!');
  }
  
  async delete(_fileId) {
    throw new Error('لازم تـ override هالميثود!');
  }
}

/**
 * محول GridFS
 */
class GridFSAdapter extends StorageAdapter {
  async upload(buffer, filename, contentType, metadata) {
    return uploadToGridFS(buffer, filename, contentType, metadata);
  }
  
  getDownloadStream(fileId) {
    return getDownloadStream(fileId);
  }
  
  getPartialDownloadStream(fileId, start, end) {
    return getPartialDownloadStream(fileId, start, end);
  }
  
  async getFileInfo(fileId) {
    return getFileInfo(fileId);
  }
  
  async delete(fileId) {
    return deleteFromGridFS(fileId);
  }
}

/**
 * محول S3 - TODO: مش مكتمل
 * نحتاج نضيفو AWS SDK
 */
class S3Adapter extends StorageAdapter {
  constructor(_config) {
    super();
    // TODO: نهيئو S3 client
    // this.s3 = new S3Client(config);
  }
  
  async upload(_buffer, _filename, _contentType, _metadata) {
    // TODO: نرفعو للـ S3
    throw new Error('S3 Adapter مش مكتمل بعد! شوف STORAGE_MIGRATION.md');
  }
  
  getDownloadStream(_fileId) {
    // TODO: نجيبو ستريم من S3
    throw new Error('S3 Adapter مش مكتمل بعد!');
  }
  
  async getFileInfo(_fileId) {
    // TODO: نجيبو معلومات من S3
    throw new Error('S3 Adapter مش مكتمل بعد!');
  }
  
  async delete(_fileId) {
    // TODO: نمسحو من S3
    throw new Error('S3 Adapter مش مكتمل بعد!');
  }
}

// نختارو المحول حسب الـ environment
const getStorageAdapter = () => {
  const provider = process.env.STORAGE_PROVIDER || 'gridfs';
  
  switch (provider) {
    case 's3':
      return new S3Adapter({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
        bucket: process.env.AWS_S3_BUCKET,
      });
    case 'gridfs':
    default:
      return new GridFSAdapter();
  }
};

// ننشئو instance واحد
let storageAdapter = null;

const getStorage = () => {
  if (!storageAdapter) {
    storageAdapter = getStorageAdapter();
  }
  return storageAdapter;
};

module.exports = {
  uploadToGridFS,
  getDownloadStream,
  getPartialDownloadStream,
  getFileInfo,
  deleteFromGridFS,
  validateFileType,
  StorageAdapter,
  GridFSAdapter,
  S3Adapter,
  getStorage,
};
