/**
 * Media Controller / كونترولر الميديا
 * هنا نتعاملو مع streaming الفيديو والصوت والتحميل
 */

const { getFileInfo, getDownloadStream, getPartialDownloadStream } = require('../services/storageService');
const { Content, AuditLog } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    نبعثو الملف مع دعم Range requests
 * @route   GET /api/media/:fileId
 * @access  Public (بعض الملفات محمية)
 */
const streamMedia = asyncHandler(async (req, res, next) => {
  const { fileId } = req.params;

  // نجيبو معلومات الملف
  const fileInfo = await getFileInfo(fileId);

  if (!fileInfo) {
    return next(new AppError('الملف ما لقيناهش!', 404));
  }

  const fileSize = fileInfo.length;
  const contentType = fileInfo.contentType || 'application/octet-stream';

  // نشوفو إذا عندنا Range header
  const range = req.headers.range;

  // Set CORS headers explicitly for cross-origin video/audio playback
  const origin = req.headers.origin;
  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
  }

  if (range) {
    // Partial Content - للـ streaming
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    // نتأكدو الـ range صحيح
    if (start >= fileSize || end >= fileSize) {
      res.status(416).set('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const chunkSize = end - start + 1;

    // Headers للـ partial content
    res.status(206).set({
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
    });

    // نبعثو الجزء المطلوب
    const downloadStream = getPartialDownloadStream(fileId, start, end);
    
    downloadStream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        next(new AppError('خطأ في قراءة الملف', 500));
      }
    });

    downloadStream.pipe(res);
  } else {
    // Full Content - نبعثو الملف كامل
    res.set({
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000',
      'ETag': `"${fileInfo._id.toString()}"`,
    });

    const downloadStream = getDownloadStream(fileId);
    
    downloadStream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        next(new AppError('خطأ في قراءة الملف', 500));
      }
    });

    downloadStream.pipe(res);
  }
});

/**
 * @desc    نبعثو ملف للتحميل (مش streaming)
 * @route   GET /api/media/:fileId/download
 * @access  May require auth for paid content
 */
const downloadMedia = asyncHandler(async (req, res, next) => {
  const { fileId } = req.params;

  // نجيبو معلومات الملف
  const fileInfo = await getFileInfo(fileId);

  if (!fileInfo) {
    return next(new AppError('الملف ما لقيناهش!', 404));
  }

  // نسجلو التحميل
  if (req.user) {
    await AuditLog.log({
      userId: req.user._id,
      action: 'CONTENT_DOWNLOAD',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      resource: `File:${fileId}`,
      result: 'success',
    });
  }

  // نبعثو الملف
  res.set({
    'Content-Type': fileInfo.contentType || 'application/octet-stream',
    'Content-Length': fileInfo.length,
    'Content-Disposition': `attachment; filename="${encodeURIComponent(fileInfo.filename)}"`,
    'Cache-Control': 'private, no-cache',
  });

  const downloadStream = getDownloadStream(fileId);
  downloadStream.pipe(res);
});

/**
 * @desc    نحصلو على معلومات الملف
 * @route   GET /api/media/:fileId/info
 * @access  Public
 */
const getMediaInfo = asyncHandler(async (req, res, next) => {
  const { fileId } = req.params;

  const fileInfo = await getFileInfo(fileId);

  if (!fileInfo) {
    return next(new AppError('الملف ما لقيناهش!', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      id: fileInfo._id,
      filename: fileInfo.filename,
      contentType: fileInfo.contentType,
      size: fileInfo.length,
      uploadDate: fileInfo.uploadDate,
      metadata: fileInfo.metadata,
    },
  });
});

/**
 * @desc    نزيدو مشاهدة للمحتوى
 * @route   POST /api/media/views/:contentId
 * @access  Public
 */
const trackView = asyncHandler(async (req, res, _next) => {
  const { contentId } = req.params;

  // نجيبو المحتوى ونزيدو المشاهدات
  const content = await Content.findById(contentId);

  if (content) {
    // Debouncing - ما نزيدوش مشاهدات من نفس الـ IP في دقيقة
    const viewKey = `view:${contentId}:${req.ip}`;
    
    // TODO: نستعملو Redis للـ debouncing
    // للحين نزيدو مباشرة
    content.views += 1;
    await content.save({ validateBeforeSave: false });

    await AuditLog.log({
      userId: req.user?._id,
      action: 'CONTENT_VIEW',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      resource: `Content:${contentId}`,
      result: 'success',
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'تم تسجيل المشاهدة',
  });
});

module.exports = {
  streamMedia,
  downloadMedia,
  getMediaInfo,
  trackView,
};
