/**
 * Admin Playlist Controller / كونترولر قوائم التشغيل
 */

const { Playlist, Content, AuditLog } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * @desc    قائمة قوائم التشغيل (أدمن)
 * @route   GET /api/admin/playlists
 * @access  Private (Admin)
 */
const getAllPlaylists = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, type, search } = req.query;

  const query = {};
  if (type) query.type = type;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const total = await Playlist.countDocuments(query);
  const playlists = await Playlist.find(query)
    .populate('items.contentId', 'title type thumbnailFileId')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  res.status(200).json({
    status: 'success',
    results: playlists.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { playlists },
  });
});

/**
 * @desc    إنشاء قائمة تشغيل جديدة
 * @route   POST /api/admin/playlists
 * @access  Private (Admin)
 */
const createPlaylist = asyncHandler(async (req, res, next) => {
  const { title, description, type, items, themes, region, tags, thumbnailFileId } = req.body;

  // ننشئو البلاي ليست
  const playlist = await Playlist.create({
    title,
    description,
    type: type || 'series',
    items: items || [],
    themes,
    region,
    tags,
    thumbnailFileId,
    createdBy: req.user._id,
  });

  await AuditLog.log({
    userId: req.user._id,
    action: 'PLAYLIST_CREATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Playlist:${playlist._id}`,
    result: 'success',
  });

  res.status(201).json({
    status: 'success',
    message: 'تم إنشاء قائمة التشغيل بنجاح!',
    data: { playlist },
  });
});

/**
 * @desc    تحديث قائمة تشغيل
 * @route   PUT /api/admin/playlists/:id
 * @access  Private (Admin)
 */
const updatePlaylist = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const allowedUpdates = ['title', 'description', 'type', 'items', 'themes', 'region', 'tags', 'thumbnailFileId', 'isActive'];
  
  const updates = {};
  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  const playlist = await Playlist.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  if (!playlist) {
    return next(new AppError('قائمة التشغيل مش موجودة!', 404));
  }

  await AuditLog.log({
    userId: req.user._id,
    action: 'PLAYLIST_UPDATE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Playlist:${playlist._id}`,
    result: 'success',
  });

  res.status(200).json({
    status: 'success',
    message: 'تم تحديث قائمة التشغيل بنجاح!',
    data: { playlist },
  });
});

/**
 * @desc    حذف قائمة تشغيل
 * @route   DELETE /api/admin/playlists/:id
 * @access  Private (Admin)
 */
const deletePlaylist = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const playlist = await Playlist.findByIdAndDelete(id);

  if (!playlist) {
    return next(new AppError('قائمة التشغيل مش موجودة!', 404));
  }

  await AuditLog.log({
    userId: req.user._id,
    action: 'PLAYLIST_DELETE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    resource: `Playlist:${id}`,
    result: 'success',
  });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

module.exports = {
  getAllPlaylists,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
};
