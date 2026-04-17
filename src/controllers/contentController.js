/**
 * Content Controller / كونترولر المحتوى العام
 * هنا الإندبوينتز العامة للمحتوى (بدون صلاحيات أدمن)
 */

const { Content } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * @desc    قائمة المحتويات مع فلاتر
 * @route   GET /api/contents
 * @access  Public
 */
const getContents = asyncHandler(async (req, res, _next) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const {
    page = 1,
    limit = 20,
    type,
    region,
    theme,
    language,
    rights,
    freeOnly,
    visibility,
    sort = '-createdAt',
  } = req.query;

  // نبنيو الكويري
  const query = {};
  if (visibility && visibility !== 'all') {
    query.visibility = visibility;
  } else if (!visibility) {
    query.visibility = 'public';
  }

  if (type) {
    if (type.includes(',')) {
      query.type = { $in: type.split(',') };
    } else {
      query.type = type;
    }
  }
  if (region) query.region = region;
  if (theme) query.themes = theme;
  if (language) query.language = language;
  if (rights) query.rights = rights;
  if (freeOnly === 'true') query.price = 0;

  // نحسبو عدد النتائج
  const total = await Content.countDocuments(query);

  // نجيبو النتائج
  const contents = await Content.find(query)
    .select('title type region themes duration thumbnailFileId fileFileId rights price visibility createdAt')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit, 10));

  // نضيفو الـ URLs
  const contentsWithUrls = contents.map((content) => {
    const obj = content.toObject();
    obj.thumbnailUrl = content.thumbnailFileId ? `/api/media/${content.thumbnailFileId}` : null;
    obj.contentUrl = `/api/media/${content.fileFileId}`;
    return obj;
  });

  res.status(200).json({
    status: 'success',
    results: contents.length,
    total,
    page: parseInt(page, 10),
    pages: Math.ceil(total / limit),
    data: { contents: contentsWithUrls },
  });
});

/**
 * @desc    محتوى واحد بالتفصيل
 * @route   GET /api/contents/:id
 * @access  Public
 */
const getContent = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  const content = await Content.findById(id)
    .populate('createdBy', 'name');

  if (!content) {
    return next(new AppError('المحتوى ما لقيناهش!', 404));
  }

  // لو المحتوى خاص، لازم أدمن أو صاحبو
  if (content.visibility === 'private') {
    if (!req.user) {
      return next(new AppError('المحتوى خاص!', 403));
    }
    if (
      req.user.role !== 'admin' &&
      content.createdBy._id.toString() !== req.user._id.toString()
    ) {
      return next(new AppError('المحتوى خاص!', 403));
    }
  }

  const obj = content.toObject();
  obj.thumbnailUrl = content.thumbnailFileId ? `/api/media/${content.thumbnailFileId}` : null;
  obj.contentUrl = `/api/media/${content.fileFileId}`;

  res.status(200).json({
    status: 'success',
    data: { content: obj },
  });
});

/**
 * @desc    محتويات مشابهة
 * @route   GET /api/contents/:id/related
 * @access  Public
 */
const getRelatedContent = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { limit = 6 } = req.query;

  const content = await Content.findById(id);

  if (!content) {
    return next(new AppError('المحتوى ما لقيناهش!', 404));
  }

  // نلقاو محتويات مشابهة بالنوع أو المنطقة
  const related = await Content.find({
    _id: { $ne: id },
    visibility: 'public',
    $or: [
      { type: content.type },
      { region: content.region },
      { themes: { $in: content.themes } },
    ],
  })
    .select('title type region thumbnailFileId duration rights price')
    .limit(parseInt(limit, 10));

  res.status(200).json({
    status: 'success',
    data: { related },
  });
});

module.exports = {
  getContents,
  getContent,
  getRelatedContent,
};
