/**
 * Search Controller / كونترولر البحث
 * هنا نتعاملو مع البحث في المحتويات والصور
 */

const { Content, Photo, Pack } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    بحث شامل
 * @route   GET /api/search
 * @access  Public
 */
const search = asyncHandler(async (req, res, _next) => {
  const { q, type, page = 1, limit = 20 } = req.query;
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  if (!q || q.trim().length < 2) {
    return res.status(200).json({
      status: 'success',
      data: {
        contents: [],
        photos: [],
        packs: [],
        total: 0,
      },
    });
  }

  const searchRegex = new RegExp(q, 'i');
  const skip = (page - 1) * limit;
  const limitNum = parseInt(limit, 10);

  let contents = [];
  let photos = [];
  let packs = [];

  // لو ما حددناش نوع، نبحثو في الكل
  const searchTypes = type ? [type] : ['content', 'photo', 'pack'];

  // بحث في المحتويات
  if (searchTypes.includes('content')) {
    contents = await Content.find({
      visibility: 'public',
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
      ],
    })
      .select('title description type region thumbnailFileId rights price duration')
      .skip(skip)
      .limit(limitNum);
  }

  // بحث في الصور
  if (searchTypes.includes('photo')) {
    photos = await Photo.find({
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
        { governorate: searchRegex },
      ],
    })
      .select('title description governorate landscapeType priceTND lowResFileId')
      .skip(skip)
      .limit(limitNum);
  }

  // بحث في الباكات
  if (searchTypes.includes('pack')) {
    packs = await Pack.find({
      isActive: true,
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { regionTag: searchRegex },
      ],
    })
      .select('title description priceTND regionTag photoIds')
      .skip(skip)
      .limit(limitNum);
  }

  // نضيفو عدد الصور للباكات
  packs = packs.map((pack) => {
    const obj = pack.toObject();
    obj.photoCount = pack.photoIds?.length || 0;
    return obj;
  });

  // نضيفو الـ URLs للصور
  photos = photos.map((photo) => {
    const obj = photo.toObject();
    obj.previewUrl = `${baseUrl}/api/photos/${photo._id}/preview`;
    return obj;
  });

  res.status(200).json({
    status: 'success',
    data: {
      contents,
      photos,
      packs,
      total: contents.length + photos.length + packs.length,
    },
  });
});

/**
 * @desc    بحث بالنص الكامل (MongoDB text index)
 * @route   GET /api/search/fulltext
 * @access  Public
 */
const fulltextSearch = asyncHandler(async (req, res, _next) => {
  const { q, type = 'all', page = 1, limit = 20 } = req.query;
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  if (!q || q.trim().length < 2) {
    return res.status(200).json({
      status: 'success',
      data: { results: [], total: 0 },
    });
  }

  const skip = (page - 1) * limit;
  const limitNum = parseInt(limit, 10);

  let results = [];

  if (type === 'content' || type === 'all') {
    const contents = await Content.find(
      { $text: { $search: q }, visibility: 'public' },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .select('title description type region rights price')
      .skip(skip)
      .limit(limitNum);

    results = results.concat(
      contents.map((c) => ({ ...c.toObject(), resultType: 'content' }))
    );
  }

  if (type === 'photo' || type === 'all') {
    const photos = await Photo.find(
      { $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .select('title description governorate landscapeType priceTND')
      .skip(skip)
      .limit(limitNum);

    results = results.concat(
      photos.map((p) => ({
        ...p.toObject(),
        resultType: 'photo',
        previewUrl: `${baseUrl}/api/photos/${p._id}/preview`,
      }))
    );
  }

  res.status(200).json({
    status: 'success',
    data: {
      results,
      total: results.length,
      page: parseInt(page, 10),
    },
  });
});

/**
 * @desc    اقتراحات البحث (autocomplete)
 * @route   GET /api/search/suggest
 * @access  Public
 */
const searchSuggestions = asyncHandler(async (req, res, _next) => {
  const { q } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(200).json({
      status: 'success',
      data: { suggestions: [] },
    });
  }

  const searchRegex = new RegExp(`^${q}`, 'i');

  // نجيبو العناوين الي تبدأ بالنص
  const [contentTitles, photoTitles, packTitles] = await Promise.all([
    Content.find({ title: searchRegex, visibility: 'public' })
      .select('title')
      .limit(5),
    Photo.find({ title: searchRegex })
      .select('title')
      .limit(5),
    Pack.find({ title: searchRegex, isActive: true })
      .select('title')
      .limit(5),
  ]);

  const suggestions = [
    ...contentTitles.map((c) => ({ text: c.title, type: 'content' })),
    ...photoTitles.map((p) => ({ text: p.title, type: 'photo' })),
    ...packTitles.map((p) => ({ text: p.title, type: 'pack' })),
  ].slice(0, 10);

  res.status(200).json({
    status: 'success',
    data: { suggestions },
  });
});

module.exports = {
  search,
  fulltextSearch,
  searchSuggestions,
};
