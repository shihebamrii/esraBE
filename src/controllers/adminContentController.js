/**
 * Admin Content Controller / كونترولر محتوى الأدمن
 * هنا نتعاملو مع رفع وإدارة المحتوى (فيديو، صوت، ريلز)
 */

const { Content, AuditLog } = require('../models');
const { uploadToGridFS, deleteFromGridFS } = require('../services/storageService');
const { createThumbnail } = require('../services/imageProcessor');
const { ensureCompatibleCodec } = require('../services/videoProcessor');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { notifyAllUsers, notifyUser } = require('../services/notificationService');
const { safeParseJSON } = require('../utils/safeParser');

/**
 * @desc    رفع محتوى جديد (فيديو/صوت/ريلز)
 * @route   POST /api/admin/content/upload
 * @access  Private (Admin/Uploader)
 */
const uploadContent = asyncHandler(async (req, res, next) => {
  // نتأكدو عندنا ملف
  if (!req.files || !req.files.file || req.files.file.length === 0) {
    return next(new AppError('الملف ضروري!', 400));
  }

  const mainFile = req.files.file[0];
  const thumbnailFile = req.files.thumbnail?.[0];

  // نحددوا نوع المحتوى من الـ MIME type
  let contentType;
  let finalVideoBuffer = mainFile.buffer;
  let videoMetadata = {};

  if (mainFile.mimetype.startsWith('video/')) {
    contentType = mainFile.mimetype.includes('reel') ? 'reel' : 'video';
    
    // Transcode if HEVC
    const processed = await ensureCompatibleCodec(mainFile.buffer, mainFile.originalname);
    finalVideoBuffer = processed.buffer;
    videoMetadata = processed.info;
  } else if (mainFile.mimetype.startsWith('audio/')) {
    contentType = 'audio';
  } else {
    return next(new AppError('نوع الملف مش مدعوم!', 400));
  }

  // نرفعوا الملف الرئيسي لـ GridFS
  const fileFileId = await uploadToGridFS(
    finalVideoBuffer,
    mainFile.originalname,
    mainFile.mimetype,
    {
      uploadedBy: req.user._id,
      type: 'content',
      codec: videoMetadata.codec,
    }
  );

  // نعالجو الـ thumbnail
  let thumbnailFileId = null;
  if (thumbnailFile) {
    // نعملو thumbnail بحجم مناسب
    const thumbnailBuffer = await createThumbnail(thumbnailFile.buffer, {
      width: 640,
      height: 360,
      fit: 'cover',
    });

    thumbnailFileId = await uploadToGridFS(
      thumbnailBuffer,
      `thumb_${mainFile.originalname}.jpg`,
      'image/jpeg',
      {
        uploadedBy: req.user._id,
        type: 'thumbnail',
      }
    );
  }

  // ناخذو البيانات من الـ body
  const {
    title,
    description,
    authors,
    type,
    themes,
    region,
    tags,
    language,
    duration,
    rights,
    price,
    pricePersonal,
    priceCommercial,
    licenseInfo,
    visibility,
    metadata,
  } = req.body;

  // ننشئو المحتوى
  const content = await Content.create({
    title,
    description,
    authors: safeParseJSON(authors),
    type: type || contentType,
    themes: safeParseJSON(themes),
    region,
    tags: safeParseJSON(tags),
    language: language || 'ar',
    duration: duration ? parseFloat(duration) : undefined,
    thumbnailFileId,
    fileFileId,
    rights: rights || 'free',
    price: price ? parseFloat(price) : (pricePersonal ? parseFloat(pricePersonal) : 0),
    pricePersonal: pricePersonal ? parseFloat(pricePersonal) : (price ? parseFloat(price) : 0),
    priceCommercial: priceCommercial ? parseFloat(priceCommercial) : 0,
    licenseInfo,
    visibility: visibility || 'public',
    createdBy: req.user._id,
    approvalStatus: 'approved',
    publishedAt: visibility === 'public' ? new Date() : undefined,
    metadata: safeParseJSON(metadata, {}),
    fileInfo: {
      filename: mainFile.originalname,
      contentType: mainFile.mimetype,
      size: finalVideoBuffer.length,
      duration: videoMetadata.duration || duration,
      width: videoMetadata.width,
      height: videoMetadata.height,
      codec: videoMetadata.codec,
    },
  });

  // نسجلو في الـ audit log
  await AuditLog.log({
    userId: req.user._id,
    action: 'CONTENT_CREATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Content:${content._id}`,
    result: 'success',
  });

  // إرسال إشعار لكل المستخدمين
  await notifyAllUsers({
    title: 'محتوى جديد!',
    message: `تمت إضافة محتوى جديد: ${title}`,
    type: 'new_content',
    link: `/content/${content._id}`
  });

  res.status(201).json({
    status: 'success',
    message: 'تم رفع المحتوى بنجاح!',
    data: { content },
  });
});

/**
 * @desc    الحصول على كل المحتويات (للأدمن)
 * @route   GET /api/admin/content
 * @access  Private (Admin)
 */
const getAllContent = asyncHandler(async (req, res, _next) => {
  const { page = 1, limit = 20, type, visibility, sort = '-createdAt' } = req.query;

  const query = {};
  if (type) query.type = type;
  if (visibility) query.visibility = visibility;

  const contents = await Content.find(query)
    .populate('createdBy', 'name email role')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  const total = await Content.countDocuments(query);

  res.status(200).json({
    status: 'success',
    results: contents.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { contents },
  });
});

/**
 * @desc    تحديث محتوى
 * @route   PUT /api/admin/content/:id
 * @access  Private (Admin/Uploader - owner)
 */
const updateContent = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const content = await Content.findById(id);

  if (!content) {
    return next(new AppError('المحتوى ما لقيناهش!', 404));
  }

  // نتأكدو المستخدم عندو صلاحية (أدمن أو صاحب المحتوى)
  if (
    req.user.role !== 'admin' &&
    content.createdBy.toString() !== req.user._id.toString()
  ) {
    return next(new AppError('ما عندكش صلاحية تعدل على هذا المحتوى!', 403));
  }

  // الفيلدز الي نقدرو نحدثوها
  const allowedUpdates = [
    'title',
    'description',
    'authors',
    'themes',
    'region',
    'tags',
    'language',
    'rights',
    'price',
    'pricePersonal',
    'priceCommercial',
    'licenseInfo',
    'visibility',
    'type',
    'duration',
    'metadata',
  ];

  const updates = {};
  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) {
      // للـ arrays نحاولو نـ parse
      if (['authors', 'themes', 'tags', 'metadata'].includes(field) && typeof req.body[field] === 'string') {
        updates[field] = safeParseJSON(req.body[field], field === 'metadata' ? {} : []);
      } else if (['price', 'pricePersonal', 'priceCommercial', 'duration'].includes(field)) {
        updates[field] = parseFloat(req.body[field]) || 0;
      } else {
        updates[field] = req.body[field];
      }
    }
  }

  // لو الـ visibility تبدل لـ public، نحدثو publishedAt
  if (updates.visibility === 'public' && content.visibility !== 'public') {
    updates.publishedAt = new Date();
  }

  const updatedContent = await Content.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  await AuditLog.log({
    userId: req.user._id,
    action: 'CONTENT_UPDATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Content:${id}`,
    details: { updates: Object.keys(updates) },
    result: 'success',
  });

  res.status(200).json({
    status: 'success',
    message: 'تم تحديث المحتوى!',
    data: { content: updatedContent },
  });
});

/**
 * @desc    حذف محتوى
 * @route   DELETE /api/admin/content/:id
 * @access  Private (Admin)
 */
const deleteContent = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const content = await Content.findById(id);

  if (!content) {
    return next(new AppError('المحتوى ما لقيناهش!', 404));
  }

  // نمسحو الملفات من GridFS
  if (content.fileFileId) {
    await deleteFromGridFS(content.fileFileId);
  }
  if (content.thumbnailFileId) {
    await deleteFromGridFS(content.thumbnailFileId);
  }

  // نمسحو من الداتابيز
  await Content.findByIdAndDelete(id);

  await AuditLog.log({
    userId: req.user._id,
    action: 'CONTENT_DELETE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Content:${id}`,
    result: 'success',
  });

  res.status(200).json({
    status: 'success',
    message: 'تم حذف المحتوى!',
  });
});

/**
 * @desc    الموافقة على محتوى أو رفضه
 * @route   PUT /api/admin/content/:id/approve
 * @access  Private (Admin)
 */
const approveContent = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body; // 'approved' or 'rejected'

  if (!['approved', 'rejected'].includes(status)) {
    return next(new AppError('الحالة لازم تكون approved أو rejected!', 400));
  }

  const content = await Content.findById(id);

  if (!content) {
    return next(new AppError('المحتوى ما لقيناهش!', 404));
  }

  content.approvalStatus = status;
  await content.save({ validateBeforeSave: false });

  await AuditLog.log({
    userId: req.user._id,
    action: 'CONTENT_APPROVE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Content:${id}`,
    details: { status },
    result: 'success',
  });

  // إرسال إشعار للمستخدم
  if (status === 'approved') {
    await notifyUser(content.createdBy, {
      title: 'تمت الموافقة!',
      message: `تمت الموافقة على محتواك: ${content.title}`,
      type: 'approval_status',
      link: `/content/${content._id}`
    });
  } else if (status === 'rejected') {
    await notifyUser(content.createdBy, {
      title: 'تم الرفض!',
      message: `تم رفض محتواك: ${content.title}`,
      type: 'approval_status',
      link: `/profile`
    });
  }

  res.status(200).json({
    status: 'success',
    message: `تم تغيير حالة المحتوى إلى ${status}!`,
    data: { content },
  });
});

module.exports = {
  uploadContent,
  getAllContent,
  updateContent,
  deleteContent,
  approveContent,
};
