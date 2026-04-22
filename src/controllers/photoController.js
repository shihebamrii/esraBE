/**
 * Photo Controller / كونترولر الصور العام
 * هنا الإندبوينتز العامة لصور Tounesna
 */

const { Photo, Pack, AuditLog } = require('../models');
const { uploadToGridFS, getFileInfo, getDownloadStream } = require('../services/storageService');
const { createLowResVersion, addTiledWatermark, getImageInfo } = require('../services/imageProcessor');
const { ensureCompatibleCodec } = require('../services/videoProcessor');
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
    approvalStatus,
    sort = '-createdAt',
    source, // 'official' or 'community' or 'all'
  } = req.query;

  // نبنيو الكويري
  const query = {};
  if (approvalStatus && approvalStatus !== 'all') {
    query.approvalStatus = approvalStatus;
  } else if (!approvalStatus) {
    query.approvalStatus = 'approved';
  }

  if (governorate) query.governorate = governorate;
  if (landscapeType) query.landscapeType = landscapeType;
  
  if (minPrice || maxPrice) {
    query.priceTND = {};
    if (minPrice) query.priceTND.$gte = parseFloat(minPrice);
    if (maxPrice) query.priceTND.$lte = parseFloat(maxPrice);
  }
  
  if (freeOnly === 'true') query.priceTND = 0;

  // Build aggregation pipeline for source filtering
  let aggregationPipeline = [{ $match: query }];

  // Add lookup to get user info for source filtering
  if (source && source !== 'all') {
    aggregationPipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator',
        },
      },
      {
        $match: {
          'creator.role': source === 'official' ? 'admin' : { $ne: 'admin' },
        },
      }
    );
  }

  // Count total documents
  const countPipeline = [...aggregationPipeline, { $count: 'total' }];
  const countResult = await Photo.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  // Add pagination and projection
  aggregationPipeline.push(
    {
      $lookup: {
        from: 'users',
        localField: 'createdBy',
        foreignField: '_id',
        as: 'creator',
      },
    },
    {
      $addFields: {
        source: {
          $cond: {
            if: { $eq: [{ $arrayElemAt: ['$creator.role', 0] }, 'admin'] },
            then: 'official',
            else: 'community',
          },
        },
      },
    },
    {
      $project: {
        title: 1,
        description: 1,
        governorate: 1,
        landscapeType: 1,
        mediaType: 1,
        priceTND: 1,
        pricePersonalTND: 1,
        priceCommercialTND: 1,
        lowResFileId: 1,
        highResFileId: 1,
        imageUrl: 1,
        tags: 1,
        createdAt: 1,
        createdBy: 1,
        source: 1,
        'creator.name': 1,
        'creator.role': 1,
      },
    },
    { $sort: sort.startsWith('-') ? { [sort.slice(1)]: -1 } : { [sort]: 1 } },
    { $skip: (page - 1) * limit },
    { $limit: parseInt(limit, 10) }
  );

  const photos = await Photo.aggregate(aggregationPipeline);

  const photosWithUrls = photos.map(photo => {
    const obj = { ...photo };
    if (photo.imageUrl) {
      obj.previewUrl = photo.imageUrl;
    } else {
      obj.previewUrl = `/api/photos/${photo._id}/preview`;
    }
    // For video-type items, include the high-res URL for the video player
    if (photo.mediaType === 'video' && photo.highResFileId) {
      obj.highResUrl = `/api/media/${photo.highResFileId}`;
    }
    // Add creator info
    if (photo.creator && photo.creator.length > 0) {
      obj.creatorName = photo.creator[0].name;
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
  // For video-type items, include the high-res URL for the video player
  if (photo.mediaType === 'video' && photo.highResFileId) {
    obj.highResUrl = `/api/media/${photo.highResFileId}`;
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
    return next(new AppError('الصورة بالجودة العالية أو الفيديو ضروري!', 400));
  }

  const isVideo = highResFile.mimetype.startsWith('video/');
  
  let finalHighResBuffer = highResFile.buffer;
  let videoMetadata = {};

  if (isVideo) {
    // Transcode if HEVC
    const processed = await ensureCompatibleCodec(highResFile.buffer, highResFile.originalname);
    finalHighResBuffer = processed.buffer;
    videoMetadata = processed.info;
  }

  if (isVideo && !lowResFile) {
    return next(new AppError('للفيديو، الرجاء رفع صورة مصغرة (Thumbnail)!', 400));
  }

  let highResInfo = isVideo ? videoMetadata : {};
  if (!isVideo) {
    highResInfo = await getImageInfo(highResFile.buffer);
  }

  const highResFileId = await uploadToGridFS(
    finalHighResBuffer,
    highResFile.originalname,
    highResFile.mimetype,
    {
      uploadedBy: req.user._id,
      type: isVideo ? 'photo-video' : 'photo-highres',
      codec: videoMetadata.codec,
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
    pricePersonalTND,
    priceCommercialTND,
    watermark,
    attributionText,
    tags,
  } = req.body;

  // --- Parse user-provided tags ---
  let finalTags = safeParseJSON(tags) || [];

  const photo = await Photo.create({
    mediaType: isVideo ? 'video' : 'photo',
    title,
    description,
    governorate,
    landscapeType,
    lowResFileId,
    highResFileId,
    priceTND: parseFloat(pricePersonalTND || priceTND) || 0,
    pricePersonalTND: parseFloat(pricePersonalTND || priceTND) || 0,
    priceCommercialTND: parseFloat(priceCommercialTND) || 0,
    watermark: watermark !== 'false',
    attributionText: attributionText || 'Photo prise lors de la tournée de CnBees - Tourisme durable',
    createdBy: req.user._id,
    approvalStatus: 'pending', // دائما معلقة للمستخدم
    tags: finalTags,
    fileInfo: {
      highRes: { 
        filename: highResFile.originalname, 
        contentType: highResFile.mimetype, 
        size: finalHighResBuffer.length, 
        width: highResInfo.width, 
        height: highResInfo.height,
        duration: videoMetadata.duration,
        codec: videoMetadata.codec
      },
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


/**
 * @desc    الحصول على صور المستخدم الحالي
 * @route   GET /api/photos/my-uploads
 * @access  Private
 */
const getMyPhotos = asyncHandler(async (req, res, _next) => {
  const { page = 1, limit = 20, status, search } = req.query;

  const query = { createdBy: req.user._id };
  if (status && status !== 'all') query.approvalStatus = status;

  let photosQuery = Photo.find(query)
    .select('title description governorate landscapeType mediaType priceTND pricePersonalTND priceCommercialTND lowResFileId highResFileId tags createdAt approvalStatus')
    .sort({ createdAt: -1 });

  if (search) {
    photosQuery = photosQuery.find({
      ...query,
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ],
    });
  }

  const total = await Photo.countDocuments(query);

  const photos = await photosQuery
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  const photosWithUrls = photos.map(photo => {
    const obj = photo.toObject();
    obj.previewUrl = photo.imageUrl || `/api/photos/${photo._id}/preview`;
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
 * @desc    تحديث صورة المستخدم (لا يمكن تغيير الصورة نفسها)
 * @route   PUT /api/photos/my-uploads/:id
 * @access  Private
 */
const updateMyPhoto = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const photo = await Photo.findOne({ _id: id, createdBy: req.user._id });

  if (!photo) {
    return next(new AppError('الصورة ما لقيناهاش أو ما عندكش صلاحية!', 404));
  }

  // Can't edit if already approved (optional rule, can be removed)
  // if (photo.approvalStatus === 'approved') {
  //   return next(new AppError('لا يمكن تعديل الصورة بعد الموافقة عليها!', 400));
  // }

  const allowedUpdates = ['title', 'description', 'governorate', 'landscapeType', 'pricePersonalTND', 'priceCommercialTND', 'tags', 'attributionText'];

  const updates = {};
  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) {
      if (field === 'pricePersonalTND' || field === 'priceCommercialTND') {
        updates[field] = parseFloat(req.body[field]) || 0;
      } else if (field === 'tags') {
        updates[field] = typeof req.body[field] === 'string'
          ? req.body[field].split(',').map(t => t.trim()).filter(Boolean)
          : req.body[field];
      } else {
        updates[field] = req.body[field];
      }
    }
  }

  const updatedPhoto = await Photo.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  await AuditLog.log({
    userId: req.user._id,
    action: 'PHOTO_USER_UPDATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Photo:${id}`,
    details: { updates: Object.keys(updates) },
    result: 'success',
  });

  res.status(200).json({
    status: 'success',
    message: 'تم تحديث الصورة بنجاح!',
    data: { photo: updatedPhoto },
  });
});

/**
 * @desc    حذف صورة المستخدم
 * @route   DELETE /api/photos/my-uploads/:id
 * @access  Private
 */
const deleteMyPhoto = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const photo = await Photo.findOne({ _id: id, createdBy: req.user._id });

  if (!photo) {
    return next(new AppError('الصورة ما لقيناهاش أو ما عندكش صلاحية!', 404));
  }

  // Delete files from GridFS
  if (photo.highResFileId) await deleteFromGridFS(photo.highResFileId);
  if (photo.lowResFileId) await deleteFromGridFS(photo.lowResFileId);

  // Delete from database
  await Photo.findByIdAndDelete(id);

  await AuditLog.log({
    userId: req.user._id,
    action: 'PHOTO_USER_DELETE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Photo:${id}`,
    result: 'success',
  });

  res.status(200).json({
    status: 'success',
    message: 'تم حذف الصورة بنجاح!',
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
  getMyPhotos,
  updateMyPhoto,
  deleteMyPhoto,
};
