/**
 * Photo Controller / كونترولر الصور العام
 * هنا الإندبوينتز العامة لصور Tounesna
 */

const { Photo, Pack, AuditLog } = require('../models');
const { uploadToGridFS, getFileInfo, getDownloadStream } = require('../services/storageService');
const { createLowResVersion, addTiledWatermark, getImageInfo } = require('../services/imageProcessor');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { safeParseJSON } = require('../utils/safeParser');

/**
 * @desc    قائمة الصور مع فلاتر
 * @route   GET /api/photos
 * @access  Public
 */
const getPhotos = asyncHandler(async (req, res, _next) => {
  const {
    page = 1,
    limit = 20,
    governorate,
    landscapeType,
    minPrice,
    maxPrice,
    freeOnly,
    sort = '-createdAt',
  } = req.query;

  // نبنيو الكويري
  const query = { approvalStatus: 'approved' };

  if (governorate) query.governorate = governorate;
  if (landscapeType) query.landscapeType = landscapeType;
  
  if (minPrice || maxPrice) {
    query.priceTND = {};
    if (minPrice) query.priceTND.$gte = parseFloat(minPrice);
    if (maxPrice) query.priceTND.$lte = parseFloat(maxPrice);
  }
  
  if (freeOnly === 'true') query.priceTND = 0;

  const total = await Photo.countDocuments(query);

  const photos = await Photo.find(query)
    .select('title description governorate landscapeType priceTND lowResFileId imageUrl tags createdAt')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  const photosWithUrls = photos.map(photo => {
    const obj = photo.toObject();
    if (photo.imageUrl) {
      obj.previewUrl = photo.imageUrl;
    } else {
      obj.previewUrl = `/api/photos/${photo._id}/preview`;
    }
    return obj;
  });

  res.status(200).json({
    status: 'success',
    results: photos.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { photos: photosWithUrls },
  });
});

/**
 * @desc    صورة واحدة بالتفصيل
 * @route   GET /api/photos/:id
 * @access  Public
 */
const getPhoto = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const photo = await Photo.findById(id)
    .populate('packs', 'title priceTND');

  if (!photo) {
    return next(new AppError('الصورة ما لقيناهاش!', 404));
  }

  const obj = photo.toObject();
  if (photo.imageUrl) {
    obj.previewUrl = photo.imageUrl;
  } else {
    obj.previewUrl = `/api/photos/${photo._id}/preview`;
  }

  res.status(200).json({
    status: 'success',
    data: { photo: obj },
  });
});

/**
 * @desc    تحميل البريفيو (الصورة بالجودة المنخفضة مع watermark)
 * @route   GET /api/photos/:id/preview
 * @access  Public
 */
const getPhotoPreview = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const photo = await Photo.findById(id);

  if (!photo) {
    return next(new AppError('الصورة ما لقيناهاش!', 404));
  }

  // نستعملو الـ low-res لو موجودة، ولا الـ high-res
  const fileId = photo.lowResFileId || photo.highResFileId;

  const fileInfo = await getFileInfo(fileId);

  if (!fileInfo) {
    return next(new AppError('ملف الصورة ما لقيناهش!', 404));
  }

  // نسجلو التحميل
  photo.previewDownloads += 1;
  await photo.save({ validateBeforeSave: false });

  await AuditLog.log({
    userId: req.user?._id,
    action: 'PHOTO_PREVIEW',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Photo:${id}`,
    result: 'success',
  });

  // نبعثو الصورة
  res.set({
    'Content-Type': fileInfo.contentType || 'image/jpeg',
    'Content-Length': fileInfo.length,
    'Cache-Control': 'public, max-age=86400', // كاش 24 ساعة
  });

  const downloadStream = getDownloadStream(fileId);
  downloadStream.pipe(res);
});

/**
 * @desc    قائمة الباكات
 * @route   GET /api/photos/packs
 * @access  Public
 */
const getPacks = asyncHandler(async (req, res, _next) => {
  const { page = 1, limit = 20, regionTag, sort = '-createdAt' } = req.query;

  const query = { isActive: true };
  if (regionTag) query.regionTag = regionTag;

  const total = await Pack.countDocuments(query);

  const packs = await Pack.find(query)
    .populate('coverPhotoId', 'lowResFileId')
    .select('title description priceTND regionTag photoIds purchases')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  // نضيفو عدد الصور
  const packsWithInfo = packs.map((pack) => {
    const obj = pack.toObject();
    obj.photoCount = pack.photoIds.length;
    return obj;
  });

  res.status(200).json({
    status: 'success',
    results: packs.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { packs: packsWithInfo },
  });
});

/**
 * @desc    باك واحد بالتفصيل
 * @route   GET /api/photos/packs/:id
 * @access  Public
 */
const getPack = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const pack = await Pack.findById(id)
    .populate('photoIds', 'title lowResFileId priceTND governorate landscapeType');

  if (!pack || !pack.isActive) {
    return next(new AppError('الباك ما لقيناهش!', 404));
  }

  // نحسبو التوفير
  const individualTotal = pack.photoIds.reduce((sum, photo) => sum + (photo.priceTND || 0), 0);
  const savings = Math.max(0, individualTotal - pack.priceTND);

  const obj = pack.toObject();
  obj.savings = savings;
  obj.individualTotal = individualTotal;

  res.status(200).json({
    status: 'success',
    data: { pack: obj },
  });
});

/**
 * @desc    الولايات المتوفرة مع عدد الصور
 * @route   GET /api/photos/governorates
 * @access  Public
 */
const getGovernorates = asyncHandler(async (req, res, _next) => {
  const governorates = await Photo.aggregate([
    { $group: { _id: '$governorate', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.status(200).json({
    status: 'success',
    data: { governorates },
  });
});

/**
 * @desc    أنواع المناظر المتوفرة مع عدد الصور
 * @route   GET /api/photos/landscape-types
 * @access  Public
 */
const getLandscapeTypes = asyncHandler(async (req, res, _next) => {
  const landscapeTypes = await Photo.aggregate([
    { $group: { _id: '$landscapeType', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.status(200).json({
    status: 'success',
    data: { landscapeTypes },
  });
});

/**
 * @desc    رفع صورة (مستخدم عادي)
 * @route   POST /api/photos/upload
 * @access  Private
 */
const uploadPhoto = asyncHandler(async (req, res, next) => {
  const highResFile = req.files?.highRes?.[0] || req.file;
  const lowResFile = req.files?.lowRes?.[0];

  if (!highResFile) {
    return next(new AppError('الصورة بالجودة العالية ضرورية!', 400));
  }

  const highResInfo = await getImageInfo(highResFile.buffer);

  const highResFileId = await uploadToGridFS(
    highResFile.buffer,
    highResFile.originalname,
    highResFile.mimetype,
    {
      uploadedBy: req.user._id,
      type: 'photo-highres',
      ...highResInfo,
    }
  );

  let lowResBuffer;
  let lowResInfo;

  if (lowResFile) {
    lowResBuffer = lowResFile.buffer;
    lowResInfo = await getImageInfo(lowResBuffer);
  } else {
    const lowResResult = await createLowResVersion(highResFile.buffer, {
      maxWidth: 800,
      maxHeight: 600,
      quality: 70,
      format: 'jpeg',
    });
    lowResBuffer = lowResResult.buffer;
    lowResInfo = lowResResult.info;
  }

  const watermarkText = req.body.attributionText || 'Photo prise lors de la tournée de CnBees - Tourisme durable';
  const watermarkedBuffer = await addTiledWatermark(lowResBuffer, watermarkText, {
    fontSize: 16,
    opacity: 0.3,
    spacing: 200,
  });

  const lowResFileId = await uploadToGridFS(
    watermarkedBuffer,
    `lowres_${highResFile.originalname}`,
    'image/jpeg',
    {
      uploadedBy: req.user._id,
      type: 'photo-lowres',
      watermarked: true,
      ...lowResInfo,
    }
  );

  const {
    title,
    description,
    governorate,
    landscapeType,
    priceTND,
    watermark,
    attributionText,
    tags,
  } = req.body;

  const photo = await Photo.create({
    title,
    description,
    governorate,
    landscapeType,
    lowResFileId,
    highResFileId,
    priceTND: parseFloat(priceTND) || 0,
    watermark: watermark !== 'false',
    attributionText: attributionText || 'Photo prise lors de la tournée de CnBees - Tourisme durable',
    createdBy: req.user._id,
    approvalStatus: 'pending', // دائما معلقة للمستخدم
    tags: safeParseJSON(tags),
    fileInfo: {
      highRes: { filename: highResFile.originalname, contentType: highResFile.mimetype, size: highResFile.size, width: highResInfo.width, height: highResInfo.height },
      lowRes: { filename: `lowres_${highResFile.originalname}`, contentType: 'image/jpeg', size: watermarkedBuffer.length, width: lowResInfo.width, height: lowResInfo.height },
    },
  });

  await AuditLog.log({
    userId: req.user._id,
    action: 'PHOTO_USER_UPLOAD',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Photo:${photo._id}`,
    result: 'success',
  });

  res.status(201).json({
    status: 'success',
    message: 'تم رفع الصورة، بانتظار موافقة الإدارة!',
    data: { photo },
  });
});

module.exports = {
  getPhotos,
  getPhoto,
  getPhotoPreview,
  getPacks,
  getPack,
  getGovernorates,
  getLandscapeTypes,
  uploadPhoto,
};
