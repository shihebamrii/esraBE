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
    throw new AppError(`خطأ في حذف الملف: ${error.message}`, 500);
  }
};

/**
 * نتأكدو من نوع الملف
 */
const validateFileType = (mimetype, allowedTypes) => {
  return allowedTypes.includes(mimetype);
};

/**
 * Get file buffer from GridFS
 * @param {ObjectId|string} fileId 
 * @returns {Promise<Buffer>}
 */
const getFileBuffer = async (fileId) => {
  const downloadStream = getDownloadStream(fileId);
  const chunks = [];
  
  return new Promise((resolve, reject) => {
    downloadStream.on('data', (chunk) => chunks.push(chunk));
    downloadStream.on('error', (err) => reject(err));
    downloadStream.on('end', () => resolve(Buffer.concat(chunks)));
  });
};

module.exports = {
  uploadToGridFS,
  getDownloadStream,
  getPartialDownloadStream,
  getFileInfo,
  deleteFromGridFS,
  validateFileType,
  getFileBuffer,
};
