/**
 * Auth Controller / كونترولر المصادقة
 * هنا نتعاملو مع التسجيل وتسجيل الدخول والباسوورد
 */

const crypto = require('crypto');
const { User, AuditLog, Pack, UserPack } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const config = require('../config');

/**
 * @desc    تسجيل مستخدم جديد
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = asyncHandler(async (req, res, _next) => {
  const { name, email, password, phone, locale, role } = req.body;

  // Validate role if provided
  let userRole = 'user';
  if (role && ['user'].includes(role)) {
    userRole = role;
  }

  // ننشئو المستخدم - الباسوورد يتشفر في الموديل
  const user = await User.create({
    name,
    email,
    passwordHash: password,
    phone,
    role: userRole,
    locale: locale || 'ar',
  });

  // نعملو التوكنز
  const accessToken = user.generateJWT();
  const refreshToken = user.generateRefreshToken();

  // نخزنو الريفريش توكن مشفر
  user.refreshTokens.push({
    token: crypto.createHash('sha256').update(refreshToken).digest('hex'),
  });
  await user.save({ validateBeforeSave: false });

  // نسجلو في الـ audit log
  await AuditLog.log({
    userId: user._id,
    action: 'AUTH_REGISTER',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    result: 'success',
  });

  // Grant "Welcome Pack" for free Impact video
  try {
    const welcomePack = await Pack.findOne({ title: 'Welcome Pack' });
    if (welcomePack) {
      await UserPack.create({
        userId: user._id,
        packId: welcomePack._id,
        orderId: user._id, // Use userId as orderId since there's no real order
        module: welcomePack.membershipFeatures.module,
        quotas: {
          photosRemaining: welcomePack.membershipFeatures.photosLimit || 0,
          reelsRemaining: welcomePack.membershipFeatures.reelsLimit || 0,
          videosRemaining: welcomePack.membershipFeatures.videosLimit || 1,
          documentariesRemaining: welcomePack.membershipFeatures.documentariesLimit || 0,
          podcastsRemaining: welcomePack.membershipFeatures.podcastsLimit || 0,
          successStoryRemaining: welcomePack.membershipFeatures.successStoryLimit || 0,
        },
        quality: welcomePack.membershipFeatures.quality,
        isActive: true,
      });
    }
  } catch (error) {
    console.error('Failed to grant welcome pack:', error);
    // Non-critical error, proceed with registration
  }

  // TODO: نبعثو إيميل تأكيد (مش مفعل حاليا)
  // await sendVerificationEmail(user.email, verificationToken);

  res.status(201).json({
    status: 'success',
    message: 'تم التسجيل بنجاح! مرحبا بيك.',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        locale: user.locale,
      },
      accessToken,
      refreshToken,
    },
  });
});

/**
 * @desc    تسجيل الدخول
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // نجيبو المستخدم مع الباسوورد
  const user = await User.findByEmail(email);

  if (!user) {
    // نسجلو المحاولة الفاشلة
    await AuditLog.log({
      action: 'AUTH_LOGIN',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      details: { email },
      result: 'failure',
      errorMessage: 'User not found',
    });
    return next(new AppError('الإيميل أو الباسوورد غالط!', 401));
  }

  // نتأكدو الحساب نشط
  if (!user.isActive) {
    return next(new AppError('الحساب موقوف! تواصل مع الإدارة.', 401));
  }

  // نقارنو الباسوورد
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    await AuditLog.log({
      userId: user._id,
      action: 'AUTH_LOGIN',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'failure',
      errorMessage: 'Wrong password',
    });
    return next(new AppError('الإيميل أو الباسوورد غالط!', 401));
  }

  // نعملو التوكنز
  const accessToken = user.generateJWT();
  const refreshToken = user.generateRefreshToken();

  // نخزنو الريفريش توكن (نخليو 5 توكنز ماكس)
  user.refreshTokens.push({
    token: crypto.createHash('sha256').update(refreshToken).digest('hex'),
  });
  if (user.refreshTokens.length > 5) {
    user.refreshTokens = user.refreshTokens.slice(-5);
  }
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  // نسجلو في الـ audit log
  await AuditLog.log({
    userId: user._id,
    action: 'AUTH_LOGIN',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    result: 'success',
  });

  res.status(200).json({
    status: 'success',
    message: 'تم تسجيل الدخول بنجاح!',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        locale: user.locale,
      },
      accessToken,
      refreshToken,
    },
  });
});

/**
 * @desc    تحديث الـ Access Token بالـ Refresh Token
 * @route   POST /api/auth/refresh-token
 * @access  Public
 */
const refreshToken = asyncHandler(async (req, res, next) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    return next(new AppError('الريفريش توكن ضروري!', 400));
  }

  try {
    // نفكو التوكن
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, config.jwt.refreshSecret);

    if (decoded.type !== 'refresh') {
      return next(new AppError('توكن غالط!', 401));
    }

    // نجيبو المستخدم
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return next(new AppError('التوكن ما عادش صالح!', 401));
    }

    // نتأكدو التوكن مخزن
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const tokenExists = user.refreshTokens.some((t) => t.token === hashedToken);

    if (!tokenExists) {
      // ممكن محاولة اختراق - نمسحو كل التوكنز
      user.refreshTokens = [];
      await user.save({ validateBeforeSave: false });

      await AuditLog.log({
        userId: user._id,
        action: 'SUSPICIOUS_ACTIVITY',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        details: { reason: 'Refresh token reuse attempt' },
        result: 'failure',
      });

      return next(new AppError('التوكن ما عادش صالح!', 401));
    }

    // نعملو توكنز جداد
    const newAccessToken = user.generateJWT();
    const newRefreshToken = user.generateRefreshToken();

    // نبدلو التوكن القديم بالجديد
    user.refreshTokens = user.refreshTokens.filter((t) => t.token !== hashedToken);
    user.refreshTokens.push({
      token: crypto.createHash('sha256').update(newRefreshToken).digest('hex'),
    });
    await user.save({ validateBeforeSave: false });

    await AuditLog.log({
      userId: user._id,
      action: 'AUTH_REFRESH_TOKEN',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'success',
    });

    res.status(200).json({
      status: 'success',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    return next(new AppError('التوكن غالط أو انتهت صلاحيتو!', 401));
  }
});

/**
 * @desc    طلب إعادة تعيين الباسوورد
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    // نرجعو success حتى لو ما لقيناش المستخدم (للأمان)
    return res.status(200).json({
      status: 'success',
      message: 'لو الإيميل موجود، باش تجيك رسالة.',
    });
  }

  // نعملو توكن إعادة التعيين
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // TODO: نبعثو إيميل مع الرابط
  // await sendPasswordResetEmail(user.email, resetToken);

  await AuditLog.log({
    userId: user._id,
    action: 'AUTH_PASSWORD_RESET',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    details: { step: 'request' },
    result: 'success',
  });

  // في التطوير نرجعو التوكن (في البروداكشن لا!)
  const response = {
    status: 'success',
    message: 'لو الإيميل موجود، باش تجيك رسالة.',
  };

  if (config.server.isDev) {
    response.devToken = resetToken;
  }

  res.status(200).json(response);
});

/**
 * @desc    إعادة تعيين الباسوورد
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
const resetPassword = asyncHandler(async (req, res, next) => {
  const { token, newPassword } = req.body;

  // نشفرو التوكن باش نقارنوه
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  // نلقاو المستخدم بالتوكن الي ما زال صالح
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError('التوكن غالط أو انتهت صلاحيتو!', 400));
  }

  // نحدثو الباسوورد
  user.passwordHash = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // نمسحو كل الريفريش توكنز القداما
  user.refreshTokens = [];
  await user.save();

  await AuditLog.log({
    userId: user._id,
    action: 'AUTH_PASSWORD_RESET',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    details: { step: 'complete' },
    result: 'success',
  });

  // نسجلو دخول المستخدم
  const accessToken = user.generateJWT();
  const refreshToken = user.generateRefreshToken();

  user.refreshTokens.push({
    token: crypto.createHash('sha256').update(refreshToken).digest('hex'),
  });
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'تم تغيير الباسوورد بنجاح!',
    data: {
      accessToken,
      refreshToken,
    },
  });
});

/**
 * @desc    الحصول على بيانات المستخدم الحالي
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res, _next) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        role: req.user.role,
        locale: req.user.locale,
        createdAt: req.user.createdAt,
        lastLogin: req.user.lastLogin,
      },
    },
  });
});

/**
 * @desc    تحديث بيانات المستخدم الحالي
 * @route   PUT /api/auth/me
 * @access  Private
 */
const updateMe = asyncHandler(async (req, res, next) => {
  const { name, email, phone, locale, password, newPassword } = req.body;

  // 1. Get user with password hash if they want to change password
  const user = await User.findById(req.user._id).select('+passwordHash');

  // 2. Check if changing password
  if (password && newPassword) {
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(new AppError('الباسوورد الحالي غالط!', 401));
    }
    user.passwordHash = newPassword;
  }

  // 3. Update other fields
  if (name) user.name = name;
  if (email) user.email = email;
  if (phone !== undefined) user.phone = phone;
  if (locale) user.locale = locale;

  await user.save();

  // 4. Log the action
  await AuditLog.log({
    userId: user._id,
    action: 'AUTH_UPDATE_PROFILE',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    result: 'success',
  });

  res.status(200).json({
    status: 'success',
    message: 'تم تحديث البيانات بنجاح!',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        locale: user.locale,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    },
  });
});

/**
 * @desc    حذف أو توقيف الحساب نهائيا (Soft Delete)
 * @route   DELETE /api/auth/me
 * @access  Private
 */
const deleteMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new AppError('مستخدم غير موجود!', 404));
  }

  // Soft delete
  user.isActive = false;
  user.refreshTokens = []; // Invalidates all sessions
  await user.save({ validateBeforeSave: false });

  // Log action
  await AuditLog.log({
    userId: user._id,
    action: 'AUTH_DELETE_ACCOUNT',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    result: 'success',
  });

  res.status(200).json({
    status: 'success',
    message: 'تم حذف الحساب بنجاح!',
  });
});

/**
 * @desc    تسجيل الخروج (حذف الريفريش توكن)
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res, _next) => {
  const { refreshToken: token } = req.body;

  if (token) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    req.user.refreshTokens = req.user.refreshTokens.filter(
      (t) => t.token !== hashedToken
    );
    await req.user.save({ validateBeforeSave: false });
  }

  await AuditLog.log({
    userId: req.user._id,
    action: 'AUTH_LOGOUT',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    result: 'success',
  });

  res.status(200).json({
    status: 'success',
    message: 'تم تسجيل الخروج بنجاح!',
  });
});

module.exports = {
  register,
  login,
  refreshToken,
  forgotPassword,
  resetPassword,
  getMe,
  updateMe,
  deleteMe,
  logout,
};
