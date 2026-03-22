/**
 * Governorate Model / موديل الولايات
 * هنا نخزنو الولايات التونسية (24 ولاية)
 */

const mongoose = require('mongoose');

const governorateSchema = new mongoose.Schema(
  {
    // الاسم بالعربية
    name_ar: {
      type: String,
      required: [true, 'الاسم بالعربية ضروري!'],
      trim: true,
    },

    // الاسم بالفرنسية
    name_fr: {
      type: String,
      required: [true, 'الاسم بالفرنسية ضروري!'],
      trim: true,
    },

    // الاسم بالإنجليزية
    name_en: {
      type: String,
      trim: true,
    },

    // Slug للـ URL
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // المنطقة (شمال، وسط، جنوب)
    region: {
      type: String,
      enum: ['north', 'center', 'south'],
    },

    // الإحداثيات (مركز الولاية)
    coordinates: {
      lat: Number,
      lng: Number,
    },

    // صورة تمثيلية
    imageFileId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // وصف قصير
    description: {
      ar: String,
      fr: String,
      en: String,
    },

    // عدد الصور المتوفرة
    photoCount: {
      type: Number,
      default: 0,
    },

    // عدد المحتويات المتوفرة
    contentCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================
// Indexes / الفهارس
// ============================================

governorateSchema.index({ slug: 1 });
governorateSchema.index({ region: 1 });

// ============================================
// Static Methods / ميثودز السكاتيك
// ============================================

/**
 * نجيبو كل الولايات مرتبة
 */
governorateSchema.statics.getAllSorted = function () {
  return this.find().sort({ name_ar: 1 });
};

/**
 * نجيبو الولايات بحسب المنطقة
 */
governorateSchema.statics.getByRegion = function (region) {
  return this.find({ region }).sort({ name_ar: 1 });
};

/**
 * نحدثو عدد الصور
 */
governorateSchema.statics.updatePhotoCounts = async function () {
  const Photo = mongoose.model('Photo');
  
  const counts = await Photo.aggregate([
    { $group: { _id: '$governorate', count: { $sum: 1 } } },
  ]);
  
  for (const { _id, count } of counts) {
    await this.updateOne(
      { $or: [{ name_ar: _id }, { name_fr: _id }, { slug: _id }] },
      { photoCount: count }
    );
  }
};

const Governorate = mongoose.model('Governorate', governorateSchema);

module.exports = Governorate;
