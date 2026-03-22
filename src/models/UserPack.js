/**
 * UserPack Model / موديل باكات المستخدم
 * هنا نخزنو باكات العضوية الي شراهم المستخدم والـ quotas الي مازالو عنده
 */

const mongoose = require('mongoose');

const userPackSchema = new mongoose.Schema(
  {
    // المستخدم
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // الباك الأصلي
    packId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pack',
      required: true,
    },

    // الطلب الي تشرى بيه
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },

    // النوع (للسهولة)
    module: {
      type: String,
      enum: ['tounesna', 'impact'],
      required: true,
    },

    // الكوتا المتبقية
    quotas: {
      photosRemaining: { type: Number, default: 0 },
      reelsRemaining: { type: Number, default: 0 },
      videosRemaining: { type: Number, default: 0 },
      documentariesRemaining: { type: Number, default: 0 },
    },

    // الجودة المسموحة
    quality: {
      type: String,
      enum: ['standard', 'hd', '4k'],
      default: 'standard',
    },

    // تاريخ الشراء
    purchasedAt: {
      type: Date,
      default: Date.now,
    },

    // إذا الباك مازال فعال (مثلا لو عندنا تاريخ انتهاء)
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================
// Indexes / الفهارس
// ============================================

userPackSchema.index({ userId: 1 });
userPackSchema.index({ packId: 1 });
userPackSchema.index({ isActive: 1 });

module.exports = mongoose.model('UserPack', userPackSchema);
