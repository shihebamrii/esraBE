/**
 * 404 Not Found Middleware / ميدلوير للطلبات الغير موجودة
 * كي ما نلقاوش الراوت نرجعو 404
 */

const AppError = require('../utils/AppError');

/**
 * نعالجو الطلبات الي ما لقيناش ليها راوت
 */
const notFound = (req, _res, next) => {
  const message = `ما لقيناش ${req.originalUrl} في السيرفر!`;
  next(new AppError(message, 404));
};

module.exports = { notFound };
