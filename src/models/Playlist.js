/**
 * Playlist Model / موديل قوائم التشغيل
 * هنا نخزنو بيانات السلسلات وقوائم الفيديوهات والبودكاست
 */

const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema(
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

    // نوع البلاي ليست
    type: {
      type: String,
      required: [true, 'نوع البلاي ليست ضروري!'],
      enum: ['series', 'collection', 'podcast_series'],
      default: 'series',
    },

    // المحتوى الي فيها (مرتب)
    items: [{
      contentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Content',
        required: true,
      },
      order: {
        type: Number,
        default: 0,
      }
    }],

    // صورة الغلاف - مرجع GridFS
    thumbnailFileId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // الثيمات / المواضيع
    themes: [{
      type: String,
      trim: true,
    }],

    // المنطقة / الولاية
    region: {
      type: String,
      trim: true,
    },

    // تاقز للبحث
    tags: [{
      type: String,
      lowercase: true,
      trim: true,
    }],

    // حالة الظهور
    isActive: {
      type: Boolean,
      default: true,
    },

    // شكون عملها
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // عدد المشاهدات / التفاعل
    views: {
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

playlistSchema.index({ title: 'text', description: 'text', tags: 'text' });
playlistSchema.index({ type: 1 });
playlistSchema.index({ isActive: 1 });
playlistSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Playlist', playlistSchema);
