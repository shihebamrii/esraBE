/**
 * Validation Middleware / ميدلوير التحقق من البيانات
 * هنا نتأكدو من صحة البيانات قبل ما توصل للكونترولر
 */

const AppError = require('../utils/AppError');

/**
 * ميدلوير للتحقق من البيانات باستعمال Joi schema
 * @param {Object} schema - سكيما Joi
 * @param {string} source - منين ناخذو البيانات (body, query, params)
 */
const validate = (schema, source = 'body') => {
  return (req, _res, next) => {
    const data = req[source];
    
    const { error, value } = schema.validate(data, {
      abortEarly: false, // نرجعو كل الأخطاء مش أول واحد برك
      stripUnknown: true, // نمسحو الفيلدز الي ما نعرفوهمش
    });
    
    if (error) {
      // نجمعو كل الأخطاء في رسالة وحدة
      const messages = error.details.map((detail) => detail.message).join('. ');
      return next(new AppError(messages, 400));
    }
    
    // نحطو البيانات المنظفة في الريكويست
    req[source] = value;
    next();
  };
};

/**
 * ميدلوير للتحقق من ObjectId في params
 */
const validateObjectId = (paramName = 'id') => {
  return (req, _res, next) => {
    const id = req.params[paramName];
    
    // نتأكدو الـ ID صحيح
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return next(new AppError(`الـ ${paramName} مش صحيح!`, 400));
    }
    
    next();
  };
};

module.exports = {
  validate,
  validateObjectId,
};
