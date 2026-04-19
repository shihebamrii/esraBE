/**
 * Admin Photo Controller / كونترولر صور الأدمن
 * هنا نتعاملو مع رفع وإدارة صور Tounesna
 */

const { Photo, AuditLog } = require('../models');
const { uploadToGridFS, deleteFromGridFS } = require('../services/storageService');
const { createLowResVersion, addTiledWatermark, getImageInfo } = require('../services/imageProcessor');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyAllUsers, notifyUser } = require('../services/notificationService');
const { safeParseJSON } = require('../utils/safeParser');

/**
 * @desc    رفع صورة جديدة
 * @route   POST /api/admin/photos/upload
 * @access  Private (Admin/Uploader)
 */
const uploadPhoto = asyncHandler(async (req, res, next) => {
  // نتأكدو عندنا صورة
  const highResFile = req.files?.highRes?.[0] || req.file;
  const lowResFile = req.files?.lowRes?.[0];

  if (!highResFile) {
    return next(new AppError('الصورة بالجودة العالية أو الفيديو ضروري!', 400));
  }

  const isVideo = highResFile.mimetype.startsWith('video/');

  if (isVideo && !lowResFile) {
    return next(new AppError('للفيديو، الرجاء رفع صورة مصغرة (Thumbnail)!', 400));
  }

  // نجيبو معلومات الصورة الأصلية
  let highResInfo = {};
  if (!isVideo) {
    highResInfo = await getImageInfo(highResFile.buffer);
  }

  // نرفعو الصورة بالجودة العالية
  const highResFileId = await uploadToGridFS(
    highResFile.buffer,
    highResFile.originalname,
    highResFile.mimetype,
    {
      uploadedBy: req.user._id,
      type: isVideo ? 'photo-video' : 'photo-highres',
      ...highResInfo,
    }
  );

  // نعالجو الصورة بالجودة المنخفضة
  let lowResBuffer;
  let lowResInfo;

  if (lowResFile) {
    // لو عندنا صورة منخفضة الجودة جاهزة
    lowResBuffer = lowResFile.buffer;
    lowResInfo = await getImageInfo(lowResBuffer);
  } else {
    // نعملو نسخة منخفضة الجودة من العالية
    const lowResResult = await createLowResVersion(highResFile.buffer, {
      maxWidth: 800,
      maxHeight: 600,
      quality: 70,
      format: 'jpeg',
    });
    lowResBuffer = lowResResult.buffer;
    lowResInfo = lowResResult.info;
  }

  // نضيفو watermark على الصورة المنخفضة
  const watermarkText = req.body.attributionText || 'Photo prise lors de la tournée de CnBees - Tourisme durable';
  const watermarkedBuffer = await addTiledWatermark(lowResBuffer, watermarkText, {
    fontSize: 16,
    opacity: 0.3,
    spacing: 200,
  });

  // نرفعو الصورة المنخفضة مع الـ watermark
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

  // ناخذو البيانات من الـ body
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

  // ننشئو الصورة
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
    approvalStatus: 'approved',
    tags: finalTags,
    fileInfo: {
      highRes: {
        filename: highResFile.originalname,
        contentType: highResFile.mimetype,
        size: highResFile.size,
        width: highResInfo.width,
        height: highResInfo.height,
      },
      lowRes: {
        filename: `lowres_${highResFile.originalname}`,
        contentType: 'image/jpeg',
        size: watermarkedBuffer.length,
        width: lowResInfo.width,
        height: lowResInfo.height,
      },
    },
  });

  // نسجلو في الـ audit log
  await AuditLog.log({
    userId: req.user._id,
    action: 'PHOTO_UPLOAD',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Photo:${photo._id}`,
    result: 'success',
  });

  // إرسال إشعار لكل المستخدمين
  await notifyAllUsers({
    title: 'صورة جديدة!',
    message: `تمت إضافه صورة جديدة من تونسنا: ${title}`,
    type: 'new_content',
    link: `/tounesna/${photo._id}`
  });

  res.status(201).json({
    status: 'success',
    message: 'تم رفع الصورة بنجاح!',
    data: { photo },
  });
});

/**
 * @desc    الحصول على كل الصور (للأدمن)
 * @route   GET /api/admin/photos
 * @access  Private (Admin)
 */
const getAllPhotos = asyncHandler(async (req, res, _next) => {
  const { page = 1, limit = 20, governorate, landscapeType, sort = '-createdAt' } = req.query;

  const query = {};
  if (governorate) query.governorate = governorate;
  if (landscapeType) query.landscapeType = landscapeType;

  const photos = await Photo.find(query)
    .populate('createdBy', 'name email role')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  const total = await Photo.countDocuments(query);

  res.status(200).json({
    status: 'success',
    results: photos.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { photos },
  });
});

/**
 * @desc    تحديث صورة
 * @route   PUT /api/admin/photos/:id
 * @access  Private (Admin/Uploader - owner)
 */
const updatePhoto = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const photo = await Photo.findById(id);

  if (!photo) {
    return next(new AppError('الصورة ما لقيناهاش!', 404));
  }

  // نتأكدو المستخدم عندو صلاحية
  if (
    req.user.role !== 'admin' &&
    photo.createdBy.toString() !== req.user._id.toString()
  ) {
    return next(new AppError('ما عندكش صلاحية تعدل على هالصورة!', 403));
  }

  // الفيلدز الي نقدرو نحدثوها
  const allowedUpdates = [
    'title',
    'description',
    'governorate',
    'landscapeType',
    'priceTND',
    'pricePersonalTND',
    'priceCommercialTND',
    'watermark',
    'attributionText',
    'mediaType',
    'tags',
  ];

  const updates = {};
  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) {
      if (field === 'tags' && typeof req.body[field] === 'string') {
        updates[field] = safeParseJSON(req.body[field]);
      } else if (['priceTND', 'pricePersonalTND', 'priceCommercialTND'].includes(field)) {
        updates[field] = parseFloat(req.body[field]) || 0;
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
    action: 'PHOTO_UPDATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Photo:${id}`,
    details: { updates: Object.keys(updates) },
    result: 'success',
  });

  res.status(200).json({
    status: 'success',
    message: 'تم تحديث الصورة!',
    data: { photo: updatedPhoto },
  });
});

/**
 * @desc    حذف صورة
 * @route   DELETE /api/admin/photos/:id
 * @access  Private (Admin)
 */
const deletePhoto = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const photo = await Photo.findById(id);

  if (!photo) {
    return next(new AppError('الصورة ما لقيناهاش!', 404));
  }

  // نمسحو الملفات من GridFS
  if (photo.highResFileId) {
    await deleteFromGridFS(photo.highResFileId);
  }
  if (photo.lowResFileId) {
    await deleteFromGridFS(photo.lowResFileId);
  }

  // نمسحو من الداتابيز
  await Photo.findByIdAndDelete(id);

  await AuditLog.log({
    userId: req.user._id,
    action: 'PHOTO_DELETE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Photo:${id}`,
    result: 'success',
  });

  res.status(200).json({
    status: 'success',
    message: 'تم حذف الصورة!',
  });
});

/**
 * @desc    الموافقة على صورة أو رفضها
 * @route   PUT /api/admin/photos/:id/approve
 * @access  Private (Admin)
 */
const approvePhoto = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body; // 'approved' or 'rejected'

  if (!['approved', 'rejected'].includes(status)) {
    return next(new AppError('الحالة لازم تكون approved أو rejected!', 400));
  }

  const photo = await Photo.findById(id);

  if (!photo) {
    return next(new AppError('الصورة ما لقيناهاش!', 404));
  }

  photo.approvalStatus = status;
  await photo.save({ validateBeforeSave: false });

  await AuditLog.log({
    userId: req.user._id,
    action: 'PHOTO_APPROVE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Photo:${id}`,
    details: { status },
    result: 'success',
  });

  // إرسال إشعار للمستخدم
  if (status === 'approved') {
    await notifyUser(photo.createdBy, {
      title: 'تمت الموافقة!',
      message: `تمت الموافقة على صورتك: ${photo.title}`,
      type: 'approval_status',
      link: `/tounesna/${photo._id}`
    });
  } else if (status === 'rejected') {
    await notifyUser(photo.createdBy, {
      title: 'تم الرفض!',
      message: `تم رفض صورتك: ${photo.title}`,
      type: 'approval_status',
      link: `/profile`
    });
  }

  res.status(200).json({
    status: 'success',
    message: `تم تغيير حالة الصورة إلى ${status}!`,
    data: { photo },
  });
});

module.exports = {
  uploadPhoto,
  getAllPhotos,
  updatePhoto,
  deletePhoto,
  approvePhoto,
};
