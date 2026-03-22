/**
 * Content Model / موديل المحتوى
 * هنا نخزنو بيانات الفيديوهات والبودكاست والريلز والأفلام الوثائقية
 */

const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema(
  {
    // العنوان
    title: {
      type: String,
      required: [true, 'العنوان ضروري!'],
      trim: true,
      maxlength: [200, 'العنوان طويل برشا'],
    },

    // الوصف
    description: {
      type: String,
      trim: true,
      maxlength: [5000, 'الوصف طويل برشا'],
    },

    // المؤلفين / المنتجين
    authors: [{
      type: String,
      trim: true,
    }],

    // نوع المحتوى
    type: {
      type: String,
      required: [true, 'نوع المحتوى ضروري!'],
      enum: ['video', 'audio', 'reel', 'documentary', 'podcast', 'photo'],
    },

    // المواضيع / الثيمات
    themes: [{
      type: String,
      trim: true,
    }],

    // المنطقة / الولاية
    region: {
      type: String,
      trim: true,
    },

    // التاقز للبحث
    tags: [{
      type: String,
      lowercase: true,
      trim: true,
    }],

    // اللغة
    language: {
      type: String,
      enum: ['ar', 'fr', 'en', 'other'],
      default: 'ar',
    },

    // المدة بالثواني
    duration: {
      type: Number,
      min: 0,
    },

    // صورة مصغرة - مرجع GridFS
    thumbnailFileId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // الملف الرئيسي - مرجع GridFS
    fileFileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'ملف المحتوى ضروري!'],
    },

    // حقوق الاستخدام
    rights: {
      type: String,
      enum: ['free', 'paid', 'license'],
      default: 'free',
    },

    // السعر إذا كان مدفوع (بالدينار)
    price: {
      type: Number,
      min: 0,
      default: 0,
    },

    // معلومات الترخيص
    licenseInfo: {
      type: String,
      trim: true,
    },

    // الرؤية - عام أو خاص
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },

    // من رفع المحتوى
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // تاريخ النشر
    publishedAt: {
      type: Date,
    },

    // ميتاداتا إضافية
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // عدد المشاهدات
    views: {
      type: Number,
      default: 0,
      min: 0,
    },

    // عدد التحميلات
    downloads: {
      type: Number,
      default: 0,
      min: 0,
    },

    // معلومات الملف
    fileInfo: {
      filename: String,
      contentType: String,
      size: Number, // بالبايت
    },

    // حالة الموافقة (للمحتوى المرفوع من المستخدمين)
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
contentSchema.index(
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
contentSchema.index({ type: 1 });
contentSchema.index({ region: 1 });
contentSchema.index({ rights: 1 });
contentSchema.index({ visibility: 1 });
contentSchema.index({ createdAt: -1 });
contentSchema.index({ views: -1 });

// ============================================
// Virtuals / الخصائص الافتراضية
// ============================================

/**
 * نرجعو إذا المحتوى مجاني
 */
contentSchema.virtual('isFree').get(function () {
  return this.rights === 'free' || this.price === 0;
});

/**
 * رابط الصورة المصغرة
 */
contentSchema.virtual('thumbnailUrl').get(function () {
  if (!this.thumbnailFileId) return null;
  return `/api/media/${this.thumbnailFileId}`;
});

/**
 * رابط المحتوى
 */
contentSchema.virtual('contentUrl').get(function () {
  return `/api/media/${this.fileFileId}`;
});

// ============================================
// Instance Methods / ميثودز الانستانس
// ============================================

/**
 * نزيدو مشاهدة واحدة
 */
contentSchema.methods.incrementViews = async function () {
  this.views += 1;
  await this.save();
};

/**
 * نزيدو تحميل واحد
 */
contentSchema.methods.incrementDownloads = async function () {
  this.downloads += 1;
  await this.save();
};

const Content = mongoose.model('Content', contentSchema);

module.exports = Content;
