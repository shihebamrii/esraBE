/**
 * Favorite Model / موديل المفضلة
 */

const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    itemType: {
      type: String,
      enum: ['Photo', 'Pack', 'Content'],
      required: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'itemType',
    },
  },
  {
    timestamps: true,
  }
);

favoriteSchema.index({ userId: 1, itemType: 1, itemId: 1 }, { unique: true });

const Favorite = mongoose.model('Favorite', favoriteSchema);

module.exports = Favorite;
