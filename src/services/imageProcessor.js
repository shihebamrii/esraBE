/**
 * Image Processor / معالج الصور
 * هنا نعملو thumbnails ونحولو الصور ونضيفو watermark
 */

const sharp = require('sharp');
const exifReader = require('exif-reader');

/**
 * Extract EXIF metadata from image buffer
 * @param {Buffer} buffer 
 * @returns {Promise<Object>}
 */
const getExifMetadata = async (buffer) => {
  try {
    const metadata = await sharp(buffer).metadata();
    let exif = {};
    
    if (metadata.exif) {
      exif = exifReader(metadata.exif);
    }

    // Process GPS coordinates if present
    let location = null;
    if (exif.gps && exif.gps.GPSLatitude && exif.gps.GPSLongitude) {
      const lat = exif.gps.GPSLatitude[0] + exif.gps.GPSLatitude[1]/60 + exif.gps.GPSLatitude[2]/3600;
      const lon = exif.gps.GPSLongitude[0] + exif.gps.GPSLongitude[1]/60 + exif.gps.GPSLongitude[2]/3600;
      
      const latRef = exif.gps.GPSLatitudeRef || 'N';
      const lonRef = exif.gps.GPSLongitudeRef || 'E';
      
      location = {
        lat: latRef === 'S' ? -lat : lat,
        lon: lonRef === 'W' ? -lon : lon
      };
    }

    return {
      camera: exif.image ? {
        make: exif.image.Make,
        model: exif.image.Model,
        software: exif.image.Software
      } : null,
      settings: exif.exif ? {
        fNumber: exif.exif.FNumber,
        exposureTime: exif.exif.ExposureTime,
        iso: exif.exif.ISO,
        focalLength: exif.exif.FocalLength,
        dateTimeOriginal: exif.exif.DateTimeOriginal
      } : null,
      location,
      file: {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        space: metadata.space,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha
      }
    };
  } catch (error) {
    console.error('Error extracting EXIF:', error);
    return null;
  }
};

/**
 * نعملو صورة بجودة منخفضة
 * @param {Buffer} buffer - الصورة الأصلية
 * @param {Object} options - الخيارات
 * @returns {Promise<{buffer: Buffer, info: Object}>}
 */
const createLowResVersion = async (buffer, options = {}) => {
  const {
    maxWidth = 800,
    maxHeight = 600,
    quality = 70,
    format = 'jpeg',
  } = options;

  const image = sharp(buffer);
  const metadata = await image.metadata();

  // نحسبو الأبعاد الجديدة
  let width = metadata.width;
  let height = metadata.height;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // نعملو الصورة
  let processedImage = image.resize(width, height, {
    fit: 'inside',
    withoutEnlargement: true,
  });

  // نحددو الفورمات
  if (format === 'jpeg' || format === 'jpg') {
    processedImage = processedImage.jpeg({ quality });
  } else if (format === 'webp') {
    processedImage = processedImage.webp({ quality });
  } else if (format === 'png') {
    processedImage = processedImage.png({ compressionLevel: 9 });
  }

  const outputBuffer = await processedImage.toBuffer();
  const outputInfo = await sharp(outputBuffer).metadata();

  return {
    buffer: outputBuffer,
    info: {
      width: outputInfo.width,
      height: outputInfo.height,
      size: outputBuffer.length,
      format: outputInfo.format,
    },
  };
};

/**
 * نعملو thumbnail
 * @param {Buffer} buffer - الصورة الأصلية
 * @param {Object} options - الخيارات
 * @returns {Promise<Buffer>}
 */
const createThumbnail = async (buffer, options = {}) => {
  const {
    width = 300,
    height = 200,
    fit = 'cover',
    format = 'jpeg',
    quality = 80,
  } = options;

  let image = sharp(buffer).resize(width, height, {
    fit,
    position: 'center',
  });

  if (format === 'jpeg' || format === 'jpg') {
    image = image.jpeg({ quality });
  } else if (format === 'webp') {
    image = image.webp({ quality });
  }

  return image.toBuffer();
};

/**
 * نضيفو watermark (نص)
 * @param {Buffer} buffer - الصورة الأصلية
 * @param {string} text - النص المائي
 * @param {Object} options - الخيارات
 * @returns {Promise<Buffer>}
 */
const addWatermark = async (buffer, text, options = {}) => {
  const {
    fontSize = 48,
    color = 'rgba(255, 255, 255, 0.5)',
    gravity = 'southeast',
  } = options;

  const svgImage = `
    <svg width="500" height="100">
      <style>
        .title { fill: ${color}; font-size: ${fontSize}px; font-weight: bold; font-family: 'Arial'; }
      </style>
      <text x="50%" y="50%" text-anchor="middle" class="title">${text}</text>
    </svg>
  `;

  return sharp(buffer)
    .composite([
      {
        input: Buffer.from(svgImage),
        gravity,
      },
    ])
    .toBuffer();
};

/**
 * نضيفو watermark (صورة)
 * @param {Buffer} buffer - الصورة الأصلية
 * @param {Buffer} watermarkBuffer - صورة الـ watermark
 * @param {Object} options - الخيارات
 * @returns {Promise<Buffer>}
 */
const addImageWatermark = async (buffer, watermarkBuffer, options = {}) => {
  const {
    width = 150,
    opacity = 0.5,
    gravity = 'southeast',
  } = options;

  const resizedWatermark = await sharp(watermarkBuffer)
    .resize(width)
    .ensureAlpha(opacity)
    .toBuffer();

  return sharp(buffer)
    .composite([
      {
        input: resizedWatermark,
        gravity,
      },
    ])
    .toBuffer();
};

/**
 * تكرار الـ watermark على كامل الصورة
 */
const addTiledWatermark = async (buffer, watermarkBuffer, options = {}) => {
  const {
    width = 100,
    opacity = 0.3,
  } = options;

  const resizedWatermark = await sharp(watermarkBuffer)
    .resize(width)
    .ensureAlpha(opacity)
    .toBuffer();

  return sharp(buffer)
    .composite([
      {
        input: resizedWatermark,
        tile: true,
      },
    ])
    .toBuffer();
};

/**
 * نجيبو معلومات الصورة
 */
const getImageInfo = async (buffer) => {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: buffer.length,
    hasAlpha: metadata.hasAlpha,
    space: metadata.space,
  };
};

/**
 * تحويل الفورمات
 */
const convertFormat = async (buffer, format, options = {}) => {
  const { quality = 80 } = options;
  let image = sharp(buffer);

  if (format === 'jpeg' || format === 'jpg') {
    image = image.jpeg({ quality });
  } else if (format === 'webp') {
    image = image.webp({ quality });
  } else if (format === 'png') {
    image = image.png({ compressionLevel: 9 });
  }

  return image.toBuffer();
};

/**
 * تعديل خصائص الصورة (brightness, contrast, etc.)
 */
const adjustImage = async (buffer, options = {}) => {
  const {
    brightness = 1,
    saturation = 1,
    hue = 0,
    lightness = 0,
  } = options;

  return sharp(buffer)
    .modulate({
      brightness,
      saturation,
      hue,
      lightness,
    })
    .toBuffer();
};

module.exports = {
  getExifMetadata,
  createLowResVersion,
  createThumbnail,
  addWatermark,
  addImageWatermark,
  addTiledWatermark,
  getImageInfo,
  convertFormat,
  adjustImage,
};
