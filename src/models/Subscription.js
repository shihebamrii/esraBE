/**
 * Subscription Model / موديل الاشتراكات
 * هنا نخزنو اشتراكات المستخدمين
 */

const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    // المستخدم
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // نوع الخطة
    plan: {
      type: String,
      enum: ['free', 'pro', 'institutional'],
      required: true,
      default: 'free',
    },

    // تاريخ البداية
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // تاريخ الانتهاء
    endDate: {
      type: Date,
    },

    // الحالة
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired', 'pending'],
      default: 'active',
    },

    // معرف الاشتراك من مزود الدفع
    externalSubscriptionId: String,

    // معلومات الدفع
    paymentInfo: {
      provider: String,
      lastPaymentDate: Date,
      nextBillingDate: Date,
      amount: Number,
      currency: String,
    },

    // المميزات حسب الخطة
    features: {
      maxDownloads: { type: Number, default: 0 }, // 0 = غير محدود
      hdQuality: { type: Boolean, default: false },
      commercialUse: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
    },

    // سبب الإلغاء
    cancellationReason: String,
    cancelledAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================
// Indexes / الفهارس
// ============================================

subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ endDate: 1 });

// ============================================
// Virtuals / الخصائص الافتراضية
// ============================================

/**
 * إذا الاشتراك نشط
 */
subscriptionSchema.virtual('isActive').get(function () {
  if (this.status !== 'active') return false;
  if (this.endDate && this.endDate < new Date()) return false;
  return true;
});

/**
 * الأيام المتبقية
 */
subscriptionSchema.virtual('daysRemaining').get(function () {
  if (!this.endDate) return null;
  const diff = this.endDate - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// ============================================
// Instance Methods / ميثودز الانستانس
// ============================================

/**
 * نلغيو الاشتراك
 * @param {string} reason - سبب الإلغاء
 */
subscriptionSchema.methods.cancel = async function (reason = '') {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  await this.save();
};

/**
 * نجددو الاشتراك
 * @param {Date} newEndDate - تاريخ الانتهاء الجديد
 */
subscriptionSchema.methods.renew = async function (newEndDate) {
  this.status = 'active';
  this.endDate = newEndDate;
  this.cancellationReason = undefined;
  this.cancelledAt = undefined;
  await this.save();
};

// ============================================
// Static Methods / ميثودز السكاتيك
// ============================================

/**
 * نلقاو الاشتراك النشط للمستخدم
 * @param {ObjectId} userId
 */
subscriptionSchema.statics.findActiveByUser = function (userId) {
  return this.findOne({
    userId,
    status: 'active',
    $or: [
      { endDate: { $gt: new Date() } },
      { endDate: null },
    ],
  });
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;
