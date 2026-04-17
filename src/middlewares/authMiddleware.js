/**
 * Auth Middleware / ميدلوير المصادقة
 * هنا نحميو الراوتز ونتأكدو من الـ JWT والرولز
 */

const jwt = require('jsonwebtoken');
const { User, AuditLog } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const config = require('../config');

/**
 * نحميو الراوت - لازم المستخدم يكون مسجل دخول
 */
const protect = asyncHandler(async (req, _res, next) => {
  let token;
  
  // ناخذو التوكن من الهيدر Authorization: Bearer <token>
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  // نتأكدو التوكن موجود
  if (!token) {
    return next(new AppError('ما عندكش صلاحية! سجل دخولك أول.', 401));
  }
  
  try {
    // نفكو التوكن
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // نجيبو المستخدم
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return next(new AppError('المستخدم ما عادش موجود!', 401));
    }
    
    // نتأكدو الحساب نشط
    if (!user.isActive) {
      return next(new AppError('الحساب موقوف! تواصل مع الإدارة.', 401));
    }
    
    // نحطو المستخدم في الريكويست
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('التوكن انتهت صلاحيتو! عاود سجل دخولك.', 401));
    }
    return next(new AppError('التوكن غالط!', 401));
  }
});

/**
 * نحددو الرولز المسموح بيها
 * @param {...string} roles - الرولز المسموح بيها
 */
const authorize = (...roles) => {
  return (req, _res, next) => {
    // نتأكدو المستخدم موجود
    if (!req.user) {
      return next(new AppError('ما عندكش صلاحية!', 401));
    }
    
    // نتأكدو الرول مسموح بيه
    if (!roles.includes(req.user.role)) {
      // نسجلو المحاولة الي ما نجحتش
      AuditLog.log({
        userId: req.user._id,
        action: 'SUSPICIOUS_ACTIVITY',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        resource: req.originalUrl,
        details: { requiredRoles: roles, userRole: req.user.role },
        result: 'failure',
      });
      
      return next(new AppError('ما عندكش صلاحية لهذا الإجراء!', 403));
    }
    
    next();
  };
};

/**
 * ميدلوير اختياري - نجيبو المستخدم لو موجود توكن
 * مفيد للراوتز الي تخدم مع وبدون تسجيل دخول
 */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.id);
      
      if (user && user.isActive) {
        req.user = user;
      }
    } catch (_error) {
      // نتجاهلو الأخطاء - المستخدم optional
    }
  }
  
  next();
});

module.exports = {
  protect,
  authorize,
  optionalAuth,
};
