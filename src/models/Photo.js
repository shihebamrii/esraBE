/**
 * Photo Model / موديل الصور
 * هنا نخزنو صور Tounesna - السياحة التونسية
 */

const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema(
  {
    // العنوان
    title: {
      type: String,
      required: [true, 'عنوان الصورة ضروري!'],
      trim: true,
      maxlength: [200, 'العنوان طويل برشا'],
    },

    // نوع الميديا (صورة أو فيديو)
    mediaType: {
      type: String,
      enum: ['photo', 'video'],
      default: 'photo',
    },

    // الوصف
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'الوصف طويل برشا'],
    },

    // الولاية
    governorate: {
      type: String,
      required: [true, 'الولاية ضرورية!'],
      trim: true,
    },

    // نوع المنظر
    landscapeType: {
      type: String,
      enum: ['sea', 'desert', 'mountain', 'village', 'oasis', 'forest', 'city', 'historical', 'other'],
      required: [true, 'نوع المنظر ضروري!'],
    },

    // صورة بجودة منخفضة - مرجع GridFS
    lowResFileId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // رابط الصورة الخارجي (للهوتلينك)
    imageUrl: {
      type: String,
      trim: true,
    },

    // صورة بجودة عالية - مرجع GridFS
    highResFileId: {
      type: mongoose.Schema.Types.ObjectId,
      // required: [true, 'الصورة بالجودة العالية ضرورية!'], // جعلناها اختيارية خاطر تنجم تكون رابط خارجي
    },

    // السعر بالدينار التونسي (تراجع: يستعمل كسعر شخصي)
    priceTND: {
      type: Number,
      min: [0, 'السعر لازم يكون إيجابي'],
      default: 0,
    },

    // سعر الترخيص الشخصي
    pricePersonalTND: {
      type: Number,
      min: [0, 'السعر لازم يكون إيجابي'],
      default: 0,
    },

    // سعر الترخيص التجاري
    priceCommercialTND: {
      type: Number,
      min: [0, 'السعر لازم يكون إيجابي'],
      default: 0,
    },

    // إذا عليها علامة مائية
    watermark: {
      type: Boolean,
      default: true,
    },

    // نص الإسناد / Attribution
    attributionText: {
      type: String,
      default: 'Photo prise lors de la tournée de CnBees - Tourisme durable',
    },

    // الباكات الي فيها هالصورة
    packs: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pack',
    }],

    // من رفع الصورة
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // التاقز للبحث
    tags: [{
      type: String,
      lowercase: true,
      trim: true,
    }],

    // معلومات الملف
    fileInfo: {
      highRes: {
        filename: String,
        contentType: String,
        size: Number,
        width: Number,
        height: Number,
        duration: Number, // للفيديو
      },
      lowRes: {
        filename: String,
        contentType: String,
        size: Number,
        width: Number,
        height: Number,
      },
    },

    // عدد التحميلات (للصورة المجانية)
    previewDownloads: {
      type: Number,
      default: 0,
    },

    // عدد المبيعات
    purchases: {
      type: Number,
      default: 0,
    },

    // عدد التحميلات الفعلية (نقرات على زر التحميل)
    downloads: {
      type: Number,
      default: 0,
    },

    // حالة الموافقة (للصور المرفوعة من المستخدمين)
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
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

// فهرس النص للبحث
photoSchema.index(
  {
    title: 'text',
    description: 'text',
    tags: 'text',
  },
  {
    language_override: 'none',
  }
);

// فهارس للفلترة
photoSchema.index({ governorate: 1 });
photoSchema.index({ landscapeType: 1 });
photoSchema.index({ priceTND: 1 });
photoSchema.index({ createdAt: -1 });

// ============================================
// Virtuals / الخصائص الافتراضية
// ============================================

/**
 * رابط البريفيو (الصورة بالجودة المنخفضة)
 */
photoSchema.virtual('previewUrl').get(function () {
  if (this.imageUrl) return this.imageUrl;
  const fileId = this.lowResFileId || this.highResFileId;
  return `/api/photos/${this._id}/preview`;
});

/**
 * رابط الصورة بالجودة العالية (يحتاج شراء)
 */
photoSchema.virtual('highResUrl').get(function () {
  if (this.imageUrl) return this.imageUrl;
  if (!this.highResFileId) return null;
  return `/api/media/${this.highResFileId}`;
});

/**
 * إذا الصورة مجانية
 */
photoSchema.virtual('isFree').get(function () {
  return (this.pricePersonalTND || this.priceTND || 0) === 0 && (this.priceCommercialTND || 0) === 0;
});

// ============================================
// Instance Methods / ميثودز الانستانس
// ============================================

/**
 * نزيدو تحميل بريفيو واحد
 */
photoSchema.methods.incrementPreviewDownloads = async function () {
  this.previewDownloads += 1;
  await this.save();
};

/**
 * نزيدو شراء واحد
 */
photoSchema.methods.incrementPurchases = async function () {
  this.purchases += 1;
  await this.save();
};

const Photo = mongoose.model('Photo', photoSchema);

module.exports = Photo;
