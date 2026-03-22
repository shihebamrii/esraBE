/**
 * Pack Model / موديل الباكات
 * هنا نخزنو مجموعات الصور المواضيعية
 */

const mongoose = require('mongoose');

const packSchema = new mongoose.Schema(
  {
    // العنوان
    title: {
      type: String,
      required: [true, 'عنوان الباك ضروري!'],
      trim: true,
      maxlength: [200, 'العنوان طويل برشا'],
    },

    // الوصف
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'الوصف طويل برشا'],
    },

    // نوع الباك
    type: {
      type: String,
      enum: ['collection', 'membership'],
      default: 'collection',
    },

    // المميزات في حالة باك عضوية
    membershipFeatures: {
      photosLimit: Number,
      reelsLimit: Number,
      videosLimit: Number,
      documentariesLimit: Number,
      quality: { type: String, enum: ['standard', 'hd', '4k'], default: 'standard' },
      module: { type: String, enum: ['tounesna', 'impact', 'both'] },
    },

    // الصور في الباك (فقط لباكات الـ collection)
    photoIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Photo',
    }],

    // السعر بالدينار التونسي
    priceTND: {
      type: Number,
      required: [true, 'السعر ضروري!'],
      min: [0, 'السعر لازم يكون إيجابي'],
    },

    // تاق المنطقة
    regionTag: {
      type: String,
      trim: true,
    },

    // صورة الغلاف - أول صورة من الباك عادة
    coverPhotoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Photo',
    },

    // إذا الباك نشط ومتاح للبيع
    isActive: {
      type: Boolean,
      default: true,
    },

    // من أنشأ الباك
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // عدد المبيعات
    purchases: {
      type: Number,
      default: 0,
    },

    // ملف ZIP المخزن - مرجع GridFS (لو محضر مسبقا)
    cachedZipFileId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // تاريخ آخر تحديث للـ ZIP
    zipGeneratedAt: Date,
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

packSchema.index({ regionTag: 1 });
packSchema.index({ isActive: 1 });
packSchema.index({ createdAt: -1 });
packSchema.index({ priceTND: 1 });

// ============================================
// Virtuals / الخصائص الافتراضية
// ============================================

/**
 * عدد الصور في الباك
 */
packSchema.virtual('photoCount').get(function () {
  return this.photoIds ? this.photoIds.length : 0;
});

/**
 * التوفير مقارنة بشراء الصور منفردة
 * (محتاج populate الصور باش يحسب)
 */
packSchema.virtual('savings').get(function () {
  // لو الصور محملين، نحسبو التوفير
  if (this.populated('photoIds') && Array.isArray(this.photoIds)) {
    const individualTotal = this.photoIds.reduce((sum, photo) => sum + (photo.priceTND || 0), 0);
    return Math.max(0, individualTotal - this.priceTND);
  }
  return null;
});

// ============================================
// Instance Methods / ميثودز الانستانس
// ============================================

/**
 * نزيدو شراء واحد
 */
packSchema.methods.incrementPurchases = async function () {
  this.purchases += 1;
  await this.save();
};

/**
 * لازم نعيدو توليد الـ ZIP؟
 * نعم لو الزيب قديم ولا ما موجودش
 */
packSchema.methods.needsZipRegeneration = function () {
  if (!this.cachedZipFileId) return true;
  if (!this.zipGeneratedAt) return true;
  
  // لو الباك تحدث بعد توليد الزيب
  return this.updatedAt > this.zipGeneratedAt;
};

const Pack = mongoose.model('Pack', packSchema);

module.exports = Pack;
