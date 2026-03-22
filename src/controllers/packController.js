/**
 * Pack Controller / كونترولر الباكات
 * هنا نتعاملو مع إنشاء وإدارة باكات الصور
 */

const { Pack, Photo, AuditLog } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    إنشاء باك جديد
 * @route   POST /api/admin/packs
 * @access  Private (Admin)
 */
const createPack = asyncHandler(async (req, res, next) => {
  const { title, description, photoIds, priceTND, regionTag, type, membershipFeatures } = req.body;

  // لو الباك من نوع collection، نتأكدو الصور موجودين
  if (type === 'collection' && photoIds) {
    const photos = await Photo.find({ _id: { $in: photoIds } });
    if (photos.length !== photoIds.length) {
      return next(new AppError('بعض الصور ما لقيناهمش!', 400));
    }
  }

  // ننشئو الباك
  const pack = await Pack.create({
    title,
    description,
    type: type || 'collection',
    membershipFeatures,
    photoIds: type === 'collection' ? photoIds : [],
    priceTND: parseFloat(priceTND) || 0,
    regionTag,
    coverPhotoId: (type === 'collection' && photoIds) ? photoIds[0] : null,
    createdBy: req.user._id,
  });

  // لو collection، نحدثو الصور باش نربطوهم بالباك
  if (type === 'collection' && photoIds) {
    await Photo.updateMany(
      { _id: { $in: photoIds } },
      { $addToSet: { packs: pack._id } }
    );
  }

  await AuditLog.log({
    userId: req.user._id,
    action: 'PACK_CREATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Pack:${pack._id}`,
    result: 'success',
  });

  res.status(201).json({
    status: 'success',
    message: 'تم إنشاء الباك بنجاح!',
    data: { pack },
  });
});

/**
 * @desc    الحصول على كل الباكات (للأدمن)
 * @route   GET /api/admin/packs
 * @access  Private (Admin)
 */
const getAllPacks = asyncHandler(async (req, res, _next) => {
  const { page = 1, limit = 20, isActive, sort = '-createdAt' } = req.query;

  const query = {};
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const packs = await Pack.find(query)
    .populate('createdBy', 'name email')
    .populate('photoIds', 'title thumbnailUrl priceTND')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  const total = await Pack.countDocuments(query);

  res.status(200).json({
    status: 'success',
    results: packs.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { packs },
  });
});

/**
 * @desc    تحديث باك
 * @route   PUT /api/admin/packs/:id
 * @access  Private (Admin)
 */
const updatePack = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const pack = await Pack.findById(id);

  if (!pack) {
    return next(new AppError('الباك ما لقيناهش!', 404));
  }

  const allowedUpdates = ['title', 'description', 'photoIds', 'priceTND', 'regionTag', 'isActive', 'type', 'membershipFeatures'];
  const updates = {};

  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) {
      if (field === 'priceTND') {
        updates[field] = parseFloat(req.body[field]);
      } else {
        updates[field] = req.body[field];
      }
    }
  }

  // لو تبدلو الصور في حالة collection
  if (updates.photoIds && (updates.type === 'collection' || pack.type === 'collection')) {
    // نمسحو الباك من الصور القديمة
    await Photo.updateMany(
      { packs: id },
      { $pull: { packs: id } }
    );
    // نضيفو الباك للصور الجديدة
    await Photo.updateMany(
      { _id: { $in: updates.photoIds } },
      { $addToSet: { packs: id } }
    );
    // نمسحو الـ cached ZIP لأنو الصور تبدلو
    updates.cachedZipFileId = null;
    updates.zipGeneratedAt = null;
    // نحدثو الـ cover
    updates.coverPhotoId = updates.photoIds[0];
  }

  const updatedPack = await Pack.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  await AuditLog.log({
    userId: req.user._id,
    action: 'PACK_UPDATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Pack:${id}`,
    details: { updates: Object.keys(updates) },
    result: 'success',
  });

  res.status(200).json({
    status: 'success',
    message: 'تم تحديث الباك!',
    data: { pack: updatedPack },
  });
});

/**
 * @desc    حذف باك
 * @route   DELETE /api/admin/packs/:id
 * @access  Private (Admin)
 */
const deletePack = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const pack = await Pack.findById(id);

  if (!pack) {
    return next(new AppError('الباك ما لقيناهش!', 404));
  }

  // نمسحو الباك من الصور
  await Photo.updateMany(
    { packs: id },
    { $pull: { packs: id } }
  );

  // TODO: نمسحو الـ cached ZIP من GridFS لو موجود

  await Pack.findByIdAndDelete(id);

  await AuditLog.log({
    userId: req.user._id,
    action: 'PACK_DELETE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Pack:${id}`,
    result: 'success',
  });

  res.status(200).json({
    status: 'success',
    message: 'تم حذف الباك!',
  });
});

module.exports = {
  createPack,
  getAllPacks,
  updatePack,
  deletePack,
};
