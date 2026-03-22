/**
 * Custom Error Class / كلاس الأخطاء المخصص
 * هنا نعرفو نوع خاص من الأخطاء باش نتحكمو فيهم خير
 */

class AppError extends Error {
  /**
   * @param {string} message - رسالة الخطأ
   * @param {number} statusCode - كود الحالة HTTP
   */
  constructor(message, statusCode) {
    super(message);
    
    this.statusCode = statusCode;
    // نحددو إذا الخطأ من العميل (4xx) ولا من السيرفر (5xx)
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    // الأخطاء المتوقعة الي نقدرو نبعثوها للعميل
    this.isOperational = true;

    // نخزنو stack trace بدون هذا الكونستراكتور
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
