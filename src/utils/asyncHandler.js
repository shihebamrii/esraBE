/**
 * Async Handler / معالج الفانكشنز غير المتزامنة
 * هذا الرابر يصطاد الأخطاء من الـ async functions ويمررهم للـ error handler
 */

/**
 * نلفو الكونترولر الـ async باش ما نحتاجوش try-catch في كل بلاصة
 * @param {Function} fn - الفانكشن الي نحبو نلفوها
 * @returns {Function} - فانكشن ملفوفة مع error handling
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    // نستناو الـ promise وإذا صار خطأ نمرروه للـ next
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;
