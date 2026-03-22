/**
 * Safe JSON Parser Utility / أداة التحليل الآمن للـ JSON
 * تساعدنا في التعامل مع البيانات الجاية من multipart/form-data
 */

/**
 * Parses a value that might be a JSON string, an array, or an object.
 * Returns an empty array or object if the value is empty or invalid.
 * 
 * @param {any} value - The value to parse
 * @param {any} defaultValue - The value to return if parsing fails (default: [])
 * @returns {any}
 */
const safeParseJSON = (value, defaultValue = []) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  // If it's already an array or object, return it (multer or other middleware might have parsed it)
  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    // If it's just a string that isn't JSON, and we expect an array, maybe it's a single value
    if (Array.isArray(defaultValue) && typeof value === 'string') {
      // Check if it looks like it was meant to be JSON (starts with [ or {)
      const trimmed = value.trim();
      if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
        return [value];
      }
    }
    
    console.error(`⚠️ Failed to parse JSON: ${value}. Returning default.`);
    return defaultValue;
  }
};

module.exports = { safeParseJSON };
