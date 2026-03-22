/**
 * Global Error Handler / معالج الأخطاء العام
 * هنا نتعاملو مع كل الأخطاء ونرجعو ريسبونس مناسب
 */

const config = require('../config');

/**
 * نتعاملو مع خطأ CastError (ObjectId غالط)
 */
const handleCastErrorDB = (err) => {
  const AppError = require('../utils/AppError');
  const message = `قيمة غالطة للـ ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

/**
 * نتعاملو مع خطأ التكرار (duplicate key)
 */
const handleDuplicateFieldsDB = (err) => {
  const AppError = require('../utils/AppError');
  // نستخرجو القيمة المكررة
  const value = err.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0] || 'unknown';
  const message = `قيمة مكررة: ${value}. استعمل قيمة أخرى!`;
  return new AppError(message, 400);
};

/**
 * نتعاملو مع خطأ الـ validation
 */
const handleValidationErrorDB = (err) => {
  const AppError = require('../utils/AppError');
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `بيانات غالطة: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

/**
 * نتعاملو مع خطأ JWT
 */
const handleJWTError = () => {
  const AppError = require('../utils/AppError');
  return new AppError('التوكن غالط. عاود سجل دخولك!', 401);
};

/**
 * نتعاملو مع انتهاء صلاحية JWT
 */
const handleJWTExpiredError = () => {
  const AppError = require('../utils/AppError');
  return new AppError('التوكن انتهت صلاحيتو. عاود سجل دخولك!', 401);
};

/**
 * نبعثو ريسبونس الخطأ في التطوير (مع تفاصيل)
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

/**
 * نبعثو ريسبونس الخطأ في البروداكشن (بدون تفاصيل حساسة)
 */
const sendErrorProd = (err, res) => {
  // الأخطاء المتوقعة: نبعثو الرسالة للعميل
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // أخطاء البرمجة أو أخطاء غير معروفة: ما نبعثوش تفاصيل
    console.error('❌ ERROR:', err);
    res.status(500).json({
      status: 'error',
      message: 'صار مشكل! حاول مرة أخرى.',
    });
  }
};

/**
 * الميدلوير الرئيسي لمعالجة الأخطاء
 */
const errorHandler = (err, _req, res, _next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (config.server.isDev) {
    // في التطوير نبعثو كل التفاصيل
    sendErrorDev(err, res);
  } else {
    // في البروداكشن نفلترو الأخطاء
    let error = { ...err };
    error.message = err.message;

    // نحولو أخطاء MongoDB لأخطاء أحسن
    if (err.name === 'CastError') error = handleCastErrorDB(error);
    if (err.code === 11000) error = handleDuplicateFieldsDB(error);
    if (err.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

module.exports = errorHandler;
