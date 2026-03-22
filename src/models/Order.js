/**
 * Order Model / موديل الطلبات
 * هنا نخزنو الطلبات والمشتريات
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

// سكيما لعنصر واحد في الطلب
const orderItemSchema = new mongoose.Schema(
  {
    // نوع العنصر
    type: {
      type: String,
      enum: ['photo', 'pack', 'content'],
      required: true,
    },
    
    // مرجع العنصر
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'items.type',
    },
    
    // السعر وقت الشراء
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    // العنوان (نسخة للتاريخ)
    title: String,
  },
  { _id: false }
);

// سكيما لتوكن التحميل
const downloadTokenSchema = new mongoose.Schema(
  {
    // التوكن (مشفر)
    token: {
      type: String,
      required: true,
    },
    
    // العنصر المرتبط
    itemType: {
      type: String,
      enum: ['photo', 'pack', 'content'],
      required: true,
    },
    
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    }
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    // المستخدم
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // العناصر المشتراة
    items: [orderItemSchema],

    // المجموع
    total: {
      type: Number,
      required: true,
      min: 0,
    },

    // العملة
    currency: {
      type: String,
      default: 'TND',
      uppercase: true,
    },

    // حالة الدفع
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },

    // مزود الدفع
    paymentProvider: {
      type: String,
      enum: ['mock', 'stripe', 'paytech'],
    },

    // معرف الدفع من المزود
    paymentId: String,

    // توكنز التحميل
    downloadTokens: [downloadTokenSchema],

    // ميتاداتا إضافية
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // بيانات الفاتورة
    billingInfo: {
      name: String,
      email: String,
      address: String,
      country: String,
    },

    // ملاحظات
    notes: String,

    // تاريخ الدفع
    paidAt: Date,

    // تاريخ الإلغاء
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

orderSchema.index({ userId: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ paymentId: 1 });
orderSchema.index({ 'downloadTokens.token': 1 });

// ============================================
// Virtuals / الخصائص الافتراضية
// ============================================

/**
 * عدد العناصر
 */
orderSchema.virtual('itemCount').get(function () {
  return this.items ? this.items.length : 0;
});

/**
 * إذا الطلب مدفوع
 */
orderSchema.virtual('isPaid').get(function () {
  return this.paymentStatus === 'paid';
});

// ============================================
// Instance Methods / ميثودز الانستانس
// ============================================

/**
 * نعملو توكن تحميل للعنصر
 * @param {string} itemType - نوع العنصر
 * @param {ObjectId} itemId - معرف العنصر
 * @param {number} expiresInHours - مدة الصلاحية بالساعات
 * @returns {string} التوكن الخام
 */
orderSchema.methods.createDownloadToken = function (itemType, itemId) {
  // نعملو توكن عشوائي
  const rawToken = crypto.randomBytes(32).toString('hex');
  
  // نخزنوه مشفر
  const hashedToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');
  
  // نضيفو التوكن
  this.downloadTokens.push({
    token: hashedToken,
    itemType,
    itemId,
  });
  
  return rawToken;
};

/**
 * نتأكدو من صلاحية توكن التحميل
 * @param {string} rawToken - التوكن الخام
 * @returns {Object|null} بيانات التوكن أو null
 */
orderSchema.methods.verifyDownloadToken = function (rawToken) {
  const hashedToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');
  
  const tokenDoc = this.downloadTokens.find(
    (t) => t.token === hashedToken
  );
  
  return tokenDoc || null;
};

/**
 * نستهلكو استخدام من التوكن
 * @param {string} rawToken - التوكن الخام
 */
orderSchema.methods.useDownloadToken = async function (rawToken) {
  // لا يوجد عدد محدود للاستخدام، لذا لا يوجد حاجة لتحديث التوكن
  // لكن نبقي الدالة فارغة لكي لا ينكسر الكود السابق
};

/**
 * نحدثو حالة الدفع لمدفوع
 */
orderSchema.methods.markAsPaid = async function (paymentId) {
  this.paymentStatus = 'paid';
  this.paymentId = paymentId;
  this.paidAt = new Date();
  await this.save();
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
