/**
 * AuditLog Model / موديل سجل المراقبة
 * هنا نخزنو كل الإجراءات المهمة للمراقبة والأمان
 */

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    // المستخدم الي عمل الإجراء (ممكن null للزوار)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // نوع الإجراء
    action: {
      type: String,
      required: true,
      enum: [
        // إجراءات المصادقة
        'AUTH_LOGIN',
        'AUTH_LOGOUT',
        'AUTH_REGISTER',
        'AUTH_PASSWORD_RESET',
        'AUTH_PASSWORD_CHANGE',
        'AUTH_REFRESH_TOKEN',
        
        // إجراءات المحتوى
        'CONTENT_CREATE',
        'CONTENT_UPDATE',
        'CONTENT_DELETE',
        'CONTENT_VIEW',
        'CONTENT_DOWNLOAD',
        
        // إجراءات الصور
        'PHOTO_UPLOAD',
        'PHOTO_UPDATE',
        'PHOTO_DELETE',
        'PHOTO_PREVIEW',
        'PHOTO_DOWNLOAD',
        
        // إجراءات الباكات
        'PACK_CREATE',
        'PACK_UPDATE',
        'PACK_DELETE',
        
        // إجراءات الشراء
        'ORDER_CREATE',
        'ORDER_PAID',
        'ORDER_CANCELLED',
        'ORDER_REFUNDED',
        
        // إجراءات المستخدم
        'USER_UPDATE',
        'USER_DELETE',
        'USER_DATA_EXPORT',
        
        // إجراءات الأدمن
        'ADMIN_USER_ROLE_CHANGE',
        'ADMIN_USER_DEACTIVATE',
        
        // أخرى
        'RATE_LIMIT_EXCEEDED',
        'SUSPICIOUS_ACTIVITY',
        'OTHER',
      ],
    },

    // عنوان IP
    ip: {
      type: String,
    },

    // User Agent
    userAgent: {
      type: String,
    },

    // المورد المتأثر (مثلا: Content:abc123)
    resource: {
      type: String,
    },

    // تفاصيل إضافية
    details: {
      type: mongoose.Schema.Types.Mixed,
    },

    // النتيجة
    result: {
      type: String,
      enum: ['success', 'failure', 'warning'],
      default: 'success',
    },

    // رسالة الخطأ لو صار مشكل
    errorMessage: String,

    // الوقت
    timestamp: {
      type: Date,
      default: Date.now,
      // index: true, // Redundant with manual indexes below
    },
  },
  {
    timestamps: false, // نستعملو timestamp متاعنا
  }
);

// ============================================
// Indexes / الفهارس
// ============================================

auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ ip: 1 });
auditLogSchema.index({ resource: 1 });

// TTL index - نمسحو السجلات القديمة بعد 90 يوم
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// ============================================
// Static Methods / ميثودز السكاتيك
// ============================================

/**
 * نسجلو إجراء
 * @param {Object} logData - بيانات السجل
 */
auditLogSchema.statics.log = async function (logData) {
  try {
    await this.create(logData);
  } catch (error) {
    // ما نوقفوش التطبيق لو فشل التسجيل
    console.error('❌ Failed to create audit log:', error.message);
  }
};

/**
 * نلقاو سجلات مستخدم معين
 * @param {ObjectId} userId
 * @param {Object} options - خيارات الفلترة والترتيب
 */
auditLogSchema.statics.findByUser = function (userId, options = {}) {
  const { limit = 50, action, startDate, endDate } = options;
  
  const query = { userId };
  
  if (action) query.action = action;
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = startDate;
    if (endDate) query.timestamp.$lte = endDate;
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit);
};

/**
 * نلقاو النشاطات المشبوهة
 */
auditLogSchema.statics.findSuspiciousActivity = function (hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.find({
    timestamp: { $gte: since },
    $or: [
      { action: 'SUSPICIOUS_ACTIVITY' },
      { action: 'RATE_LIMIT_EXCEEDED' },
      { result: 'failure' },
    ],
  }).sort({ timestamp: -1 });
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
