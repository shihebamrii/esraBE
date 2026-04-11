const mongoose = require('mongoose');

/**
 * Inquiry Model / موديل الاستفسارات والرسائل
 * هنا نخزنو الرسائل الي تجينا من الفورم متاع "اتصل بنا"
 */
const inquirySchema = new mongoose.Schema(
  {
    // اسم المرسل
    name: {
      type: String,
      required: [true, 'الاسم ضروري!'],
      trim: true,
      maxlength: [100, 'الاسم طويل برشا'],
    },

    // إيميل المرسل
    email: {
      type: String,
      required: [true, 'الإيميل ضروري!'],
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'الإيميل مش صحيح!',
      ],
    },

    // موضوع الرسالة
    subject: {
      type: String,
      required: [true, 'الموضوع ضروري!'],
      trim: true,
      maxlength: [200, 'الموضوع طويل برشا'],
    },

    // نص الرسالة
    message: {
      type: String,
      required: [true, 'الرسالة ضرورية!'],
      trim: true,
      maxlength: [2000, 'الرسالة طويلة برشا'],
    },

    // حالة الرسالة
    status: {
      type: String,
      enum: ['pending', 'read', 'replied', 'archived'],
      default: 'pending',
    },

    // ملاحظات الأدمن
    adminNotes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // createdAt و updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================
// Indexes / الفهارس
// ============================================
inquirySchema.index({ status: 1 });
inquirySchema.index({ email: 1 });
inquirySchema.index({ createdAt: -1 });

const Inquiry = mongoose.model('Inquiry', inquirySchema);

module.exports = Inquiry;
