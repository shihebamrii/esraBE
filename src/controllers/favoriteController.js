const { Photo, Pack, Content, Favorite } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * @desc    Get user favorites
 * @route   GET /api/favorites
 * @access  Private
 */
const getFavorites = asyncHandler(async (req, res, next) => {
  const favorites = await Favorite.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .populate('itemId');

  res.status(200).json({
    status: 'success',
    data: favorites
  });
});

/**
 * @desc    Toggle favorite (add/remove)
 * @route   POST /api/favorites/toggle
 * @access  Private
 */
const toggleFavorite = asyncHandler(async (req, res, next) => {
  let { itemType, itemId } = req.body;

  // Normalize itemType
  if (itemType) {
    const lowerType = itemType.toLowerCase();
    if (lowerType === 'photo') itemType = 'Photo';
    if (lowerType === 'pack') itemType = 'Pack';
    if (lowerType === 'content') itemType = 'Content';
    if (lowerType === 'video') itemType = 'Content';
  }

  if (!['Photo', 'Pack', 'Content'].includes(itemType)) {
    return next(new AppError('Item type is not valid! (Photo, Pack, Content)', 400));
  }

  // Check if item exists
  let itemExists = null;
  if (itemType === 'Photo') itemExists = await Photo.findById(itemId);
  if (itemType === 'Pack') itemExists = await Pack.findById(itemId);
  if (itemType === 'Content') itemExists = await Content.findById(itemId);

  if (!itemExists) {
    return next(new AppError('Item not found!', 404));
  }

  const existingFavorite = await Favorite.findOne({
    userId: req.user._id,
    itemType,
    itemId
  });

  if (existingFavorite) {
    await Favorite.findByIdAndDelete(existingFavorite._id);
    return res.status(200).json({ status: 'success', message: 'Removed from favorites', action: 'removed' });
  } else {
    await Favorite.create({
      userId: req.user._id,
      itemType,
      itemId
    });
    return res.status(201).json({ status: 'success', message: 'Added to favorites', action: 'added' });
  }
});

module.exports = {
  getFavorites,
  toggleFavorite
};
