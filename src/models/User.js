/**
 * User Model / موديل المستخدم
 * هنا نخزنو بيانات المستخدمين مع الباسوورد المشفر والتوكنز
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');

const userSchema = new mongoose.Schema(
  {
    // الاسم الكامل
    name: {
      type: String,
      required: [true, 'الاسم ضروري!'],
      trim: true,
      maxlength: [100, 'الاسم طويل برشا'],
    },

    // الإيميل - لازم يكون فريد
    email: {
      type: String,
      required: [true, 'الإيميل ضروري!'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'الإيميل مش صحيح!',
      ],
    },

    // رقم التليفون
    phone: {
      type: String,
      trim: true,
    },

    // الباسوورد المشفر
    passwordHash: {
      type: String,
      required: [true, 'الباسوورد ضروري!'],
      select: false, // ما نرجعوش الباسوورد في الكويريز
    },

    // الرول - ششنوا يقدر يعمل
    role: {
      type: String,
      enum: ['admin', 'user', 'uploader'],
      default: 'user',
    },

    // اللغة المفضلة
    locale: {
      type: String,
      enum: ['ar', 'fr', 'en'],
      default: 'ar',
    },

    // إذا الحساب نشط ولا لا
    isActive: {
      type: Boolean,
      default: true,
    },

    // معرف العميل في Stripe
    stripeCustomerId: {
      type: String,
    },

    // توكن إعادة تعيين الباسوورد
    passwordResetToken: String,
    passwordResetExpires: Date,

    // ريفريش توكنز مخزنين (مشفرين)
    refreshTokens: [{
      token: String,
      createdAt: { type: Date, default: Date.now },
    }],

    // آخر تسجيل دخول
    lastLogin: Date,
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

// userSchema.index({ email: 1 }); // Redundant since email has unique: true
userSchema.index({ role: 1 });

// ============================================
// Pre-save Middleware / ميدلوير قبل الحفظ
// ============================================

/**
 * نشفرو الباسوورد قبل ما نحفظوه
 */
userSchema.pre('save', async function (next) {
  // نشفرو كان الباسوورد تبدل
  if (!this.isModified('passwordHash')) return next();

  // نشفرو مع 12 salt rounds
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// ============================================
// Instance Methods / ميثودز الانستانس
// ============================================

/**
 * نقارنو الباسوورد الي دخلو المستخدم مع المخزن
 * @param {string} candidatePassword - الباسوورد الي دخلو
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * نعملو JWT access token
 * @returns {string}
 */
userSchema.methods.generateJWT = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

/**
 * نعملو JWT refresh token
 * @returns {string}
 */
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id,
      type: 'refresh',
    },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
};

/**
 * نعملو توكن إعادة تعيين الباسوورد
 * @returns {string}
 */
userSchema.methods.createPasswordResetToken = function () {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');

  // نخزنو التوكن مشفر
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // صالح لمدة 10 دقائق
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

// ============================================
// Static Methods / ميثودز السكاتيك
// ============================================

/**
 * نلقاو المستخدم بالإيميل مع الباسوورد
 * @param {string} email
 * @returns {Promise<User>}
 */
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email }).select('+passwordHash');
};

const User = mongoose.model('User', userSchema);

module.exports = User;
