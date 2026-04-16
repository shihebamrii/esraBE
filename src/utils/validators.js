/**
 * Validation Schemas / سكيماز الـ Validation
 * هنا نعرفو قواعد التحقق من البيانات باستعمال Joi
 */

const Joi = require('joi');

// ============================================
// Auth Validation / فاليديشن المصادقة
// ============================================

const authValidation = {
  /**
   * فاليديشن التسجيل
   */
  register: Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
      'string.empty': 'الاسم ضروري!',
      'string.min': 'الاسم لازم يكون أكثر من حرفين',
      'string.max': 'الاسم طويل برشا',
    }),
    email: Joi.string().email().required().messages({
      'string.empty': 'الإيميل ضروري!',
      'string.email': 'الإيميل مش صحيح!',
    }),
    password: Joi.string().min(8).max(128).required().messages({
      'string.empty': 'الباسوورد ضروري!',
      'string.min': 'الباسوورد لازم يكون على الأقل 8 أحرف',
    }),
    phone: Joi.string().allow('').optional(),
    locale: Joi.string().valid('ar', 'fr', 'en').default('ar'),
    role: Joi.string().valid('user').optional(),
  }),

  /**
   * فاليديشن تحديث الحساب
   */
  updateMe: Joi.object({
    name: Joi.string().min(2).max(100).optional().messages({
      'string.min': 'الاسم لازم يكون أكثر من حرفين',
      'string.max': 'الاسم طويل برشا',
    }),
    email: Joi.string().email().optional().messages({
      'string.email': 'الإيميل مش صحيح!',
    }),
    phone: Joi.string().allow('').optional(),
    locale: Joi.string().valid('ar', 'fr', 'en').optional(),
    password: Joi.string().optional(),
    newPassword: Joi.string().min(8).max(128).optional().messages({
      'string.min': 'الباسوورد الجديد لازم يكون على الأقل 8 أحرف',
    }),
  }).with('newPassword', 'password'), // Require current password if new password is provided

  /**
   * فاليديشن تسجيل الدخول
   */
  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.empty': 'الإيميل ضروري!',
      'string.email': 'الإيميل مش صحيح!',
    }),
    password: Joi.string().required().messages({
      'string.empty': 'الباسوورد ضروري!',
    }),
  }),

  /**
   * فاليديشن الريفريش توكن
   */
  refreshToken: Joi.object({
    refreshToken: Joi.string().required().messages({
      'string.empty': 'الريفريش توكن ضروري!',
    }),
  }),

  /**
   * فاليديشن نسيت الباسوورد
   */
  forgotPassword: Joi.object({
    email: Joi.string().email().required().messages({
      'string.empty': 'الإيميل ضروري!',
    }),
  }),

  /**
   * فاليديشن إعادة تعيين الباسوورد
   */
  resetPassword: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required().messages({
      'string.min': 'الباسوورد الجديد لازم يكون على الأقل 8 أحرف',
    }),
  }),
};

// ============================================
// Content Validation / فاليديشن المحتوى
// ============================================

const contentValidation = {
  /**
   * فاليديشن إنشاء محتوى
   */
  create: Joi.object({
    title: Joi.string().min(2).max(200).required(),
    description: Joi.string().max(5000).allow(''),
    authors: Joi.array().items(Joi.string()),
    type: Joi.string().valid('video', 'audio', 'reel', 'documentary', 'podcast').required(),
    themes: Joi.array().items(Joi.string()),
    region: Joi.string(),
    tags: Joi.array().items(Joi.string()),
    language: Joi.string().valid('ar', 'fr', 'en', 'other').default('ar'),
    duration: Joi.number().min(0),
    rights: Joi.string().valid('free', 'paid', 'license').default('free'),
    price: Joi.number().min(0).default(0),
    licenseInfo: Joi.string().allow(''),
    visibility: Joi.string().valid('public', 'private').default('public'),
    metadata: Joi.object(),
  }),

  /**
   * فاليديشن تحديث محتوى
   */
  update: Joi.object({
    title: Joi.string().min(2).max(200),
    description: Joi.string().max(5000).allow(''),
    authors: Joi.array().items(Joi.string()),
    themes: Joi.array().items(Joi.string()),
    region: Joi.string(),
    tags: Joi.array().items(Joi.string()),
    language: Joi.string().valid('ar', 'fr', 'en', 'other'),
    rights: Joi.string().valid('free', 'paid', 'license'),
    type: Joi.string().valid('video', 'audio', 'reel', 'documentary', 'podcast'),
    price: Joi.number().min(0),
    licenseInfo: Joi.string().allow(''),
    visibility: Joi.string().valid('public', 'private'),
    metadata: Joi.object(),
  }),

  /**
   * فاليديشن الفلترة
   */
  query: Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
    type: Joi.string(),
    region: Joi.string(),
    theme: Joi.string(),
    language: Joi.string(),
    rights: Joi.string().valid('free', 'paid', 'license'),
    freeOnly: Joi.boolean(),
    sort: Joi.string().valid('createdAt', '-createdAt', 'views', '-views', 'title'),
  }),
};

// ============================================
// Photo Validation / فاليديشن الصور
// ============================================

const photoValidation = {
  /**
   * فاليديشن إنشاء صورة
   */
  create: Joi.object({
    title: Joi.string().min(2).max(200).required(),
    description: Joi.string().max(2000).allow(''),
    governorate: Joi.string().required(),
    landscapeType: Joi.string().valid('sea', 'desert', 'mountain', 'village', 'oasis', 'forest', 'city', 'historical', 'other').required(),
    priceTND: Joi.number().min(0).required(),
    watermark: Joi.boolean().default(true),
    attributionText: Joi.string().default('Photo prise lors de la tournée de CnBees - Tourisme durable'),
    tags: Joi.array().items(Joi.string()),
  }),

  /**
   * فاليديشن تحديث صورة
   */
  update: Joi.object({
    title: Joi.string().min(2).max(200),
    description: Joi.string().max(2000).allow(''),
    governorate: Joi.string(),
    landscapeType: Joi.string().valid('sea', 'desert', 'mountain', 'village', 'oasis', 'forest', 'city', 'historical', 'other'),
    priceTND: Joi.number().min(0),
    watermark: Joi.boolean(),
    attributionText: Joi.string(),
    tags: Joi.array().items(Joi.string()),
  }),

  /**
   * فاليديشن الفلترة
   */
  query: Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
    governorate: Joi.string(),
    landscapeType: Joi.string(),
    minPrice: Joi.number().min(0),
    maxPrice: Joi.number().min(0),
    freeOnly: Joi.boolean(),
    sort: Joi.string().valid('createdAt', '-createdAt', 'priceTND', '-priceTND', 'title'),
  }),
};

// ============================================
// Pack Validation / فاليديشن الباكات
// ============================================

const packValidation = {
  /**
   * فاليديشن إنشاء باك
   */
  create: Joi.object({
    title: Joi.string().min(2).max(200).required(),
    description: Joi.string().max(2000).allow(''),
    type: Joi.string().valid('collection', 'membership').default('collection'),
    membershipFeatures: Joi.object({
      photosLimit: Joi.number().min(0),
      reelsLimit: Joi.number().min(0),
      videosLimit: Joi.number().min(0),
      documentariesLimit: Joi.number().min(0),
      quality: Joi.string().valid('standard', 'hd', '4k'),
      module: Joi.string().valid('tounesna', 'impact', 'both'),
    }),
    photoIds: Joi.array().items(Joi.string().hex().length(24)),
    priceTND: Joi.number().min(0).required(),
    regionTag: Joi.string(),
    isActive: Joi.boolean(),
  }),

  /**
   * فاليديشن تحديث باك
   */
  update: Joi.object({
    title: Joi.string().min(2).max(200),
    description: Joi.string().max(2000).allow(''),
    type: Joi.string().valid('collection', 'membership'),
    membershipFeatures: Joi.object({
      photosLimit: Joi.number().min(0),
      reelsLimit: Joi.number().min(0),
      videosLimit: Joi.number().min(0),
      documentariesLimit: Joi.number().min(0),
      quality: Joi.string().valid('standard', 'hd', '4k'),
      module: Joi.string().valid('tounesna', 'impact', 'both'),
    }),
    photoIds: Joi.array().items(Joi.string().hex().length(24)),
    priceTND: Joi.number().min(0),
    regionTag: Joi.string(),
    isActive: Joi.boolean(),
  }),
};

// ============================================
// Cart Validation / فاليديشن السلة
// ============================================

const cartValidation = {
  /**
   * فاليديشن إضافة للسلة
   */
  addItem: Joi.object({
    type: Joi.string().valid('photo', 'pack', 'content').required(),
    itemId: Joi.string().hex().length(24).required(),
  }),
};

// ============================================
// Order Validation / فاليديشن الطلبات
// ============================================

const orderValidation = {
  /**
   * فاليديشن الـ checkout
   */
  checkout: Joi.object({
    billingInfo: Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      address: Joi.string().allow(''),
      country: Joi.string().default('TN'),
    }).required(),
    notes: Joi.string().allow(''),
  }),
};

// ============================================
// ObjectId Validation / فاليديشن الـ ID
// ============================================

const objectIdValidation = Joi.object({
  id: Joi.string().hex().length(24).required().messages({
    'string.hex': 'الـ ID مش صحيح',
    'string.length': 'الـ ID لازم يكون 24 حرف',
  }),
});

module.exports = {
  authValidation,
  contentValidation,
  photoValidation,
  packValidation,
  cartValidation,
  orderValidation,
  objectIdValidation,
};
