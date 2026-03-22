/**
 * Public Playlist Controller / كونترولر قوائم التشغيل العامة
 */

const { Playlist } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * @desc    قائمة قوائم التشغيل العامة
 * @route   GET /api/playlists
 * @access  Public
 */
const getAllPlaylists = asyncHandler(async (req, res, next) => {
  const { type, region, theme } = req.query;

  const query = { isActive: true };
  if (type) query.type = type;
  if (region) query.region = region;
  if (theme) query.themes = theme;

  const playlists = await Playlist.find(query)
    .populate('items.contentId', 'title type thumbnailFileId duration rights price')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: playlists.length,
    data: { playlists },
  });
});

/**
 * @desc    تفاصيل قائمة تشغيل
 * @route   GET /api/playlists/:id
 * @access  Public
 */
const getPlaylist = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const playlist = await Playlist.findOne({ _id: id, isActive: true })
    .populate('items.contentId', 'title type description thumbnailFileId fileFileId duration rights price authors');

  if (!playlist) {
    return next(new AppError('قائمة التشغيل مش موجودة!', 404));
  }

  // نزيدو عدد المشاهدات
  playlist.views += 1;
  await playlist.save();

  res.status(200).json({
    status: 'success',
    data: { playlist },
  });
});

module.exports = {
  getAllPlaylists,
  getPlaylist,
};
