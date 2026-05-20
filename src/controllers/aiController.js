/**
 * AI Controller / كونترولر الذكاء الاصطناعي
 */

const { analyzeImage, chatAboutImage } = require('../services/aiService');
const { getExifMetadata } = require('../services/imageProcessor');
const { getFileBuffer, getFileInfo } = require('../services/storageService');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const axios = require('axios');

/**
 * @desc    Analyze image (AI + EXIF)
 * @route   POST /api/ai/analyze
 * @access  Public/Private
 */
const analyzePhoto = asyncHandler(async (req, res, next) => {
  const { imageUrl, fileId } = req.body;
  let buffer;
  let mimeType = 'image/jpeg';

  if (fileId) {
    const fileInfo = await getFileInfo(fileId);
    if (!fileInfo) return next(new AppError('File not found', 404));
    buffer = await getFileBuffer(fileId);
    mimeType = fileInfo.contentType;
  } else if (imageUrl) {
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      buffer = Buffer.from(response.data, 'binary');
      mimeType = response.headers['content-type'] || 'image/jpeg';
    } catch (error) {
      return next(new AppError('Failed to fetch image from URL', 400));
    }
  } else {
    return next(new AppError('Please provide fileId or imageUrl', 400));
  }

  // 1. Extract EXIF
  const metadata = await getExifMetadata(buffer);

  // 2. AI Analysis
  const aiAnalysis = await analyzeImage(buffer, mimeType);

  res.status(200).json({
    status: 'success',
    data: {
      metadata,
      aiAnalysis,
    },
  });
});

/**
 * @desc    Chat about image
 * @route   POST /api/ai/chat
 * @access  Public/Private
 */
const chatPhoto = asyncHandler(async (req, res, next) => {
  const { message, history, imageUrl, fileId } = req.body;
  let buffer;
  let mimeType = 'image/jpeg';

  if (fileId) {
    buffer = await getFileBuffer(fileId);
    const fileInfo = await getFileInfo(fileId);
    mimeType = fileInfo.contentType;
  } else if (imageUrl) {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    buffer = Buffer.from(response.data, 'binary');
    mimeType = response.headers['content-type'] || 'image/jpeg';
  }

  const aiResponse = await chatAboutImage(message, buffer, mimeType, history || []);

  res.status(200).json({
    status: 'success',
    data: {
      message: aiResponse,
    },
  });
});

module.exports = {
  analyzePhoto,
  chatPhoto,
};
