/**
 * Image Processor / معالج الصور
 * هنا نعملو thumbnails ونحولو الصور ونضيفو watermark
 */

const sharp = require('sharp');

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
    fontSize = 24,
    opacity = 0.5,
    position = 'center',
    color = 'white',
  } = options;

  const image = sharp(buffer);
  const metadata = await image.metadata();

  // نعملو SVG للنص
  const svgText = `
    <svg width="${metadata.width}" height="${metadata.height}">
      <style>
        .watermark {
          fill: ${color};
          font-size: ${fontSize}px;
          font-family: Arial, sans-serif;
          opacity: ${opacity};
        }
      </style>
      <text
        x="50%"
        y="50%"
        text-anchor="middle"
        dominant-baseline="middle"
        class="watermark"
        transform="rotate(-30, ${metadata.width / 2}, ${metadata.height / 2})"
      >${text}</text>
    </svg>
  `;

  // نضيفو الـ watermark
  return image
    .composite([
      {
        input: Buffer.from(svgText),
        gravity: position,
      },
    ])
    .toBuffer();
};

/**
 * نضيفو watermark متكرر على كل الصورة
 * @param {Buffer} buffer - الصورة الأصلية
 * @param {string} text - النص المائي
 * @param {Object} options - الخيارات
 * @returns {Promise<Buffer>}
 */
const addTiledWatermark = async (buffer, text, options = {}) => {
  const {
    fontSize = 20,
    opacity = 0.3,
    color = 'rgba(255,255,255,0.5)',
    spacing = 150,
  } = options;

  const image = sharp(buffer);
  const metadata = await image.metadata();

  // نحسبو عدد التكرارات
  const cols = Math.ceil(metadata.width / spacing) + 1;
  const rows = Math.ceil(metadata.height / spacing) + 1;

  // نعملو النص المتكرر
  let textElements = '';
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * spacing;
      const y = row * spacing;
      textElements += `
        <text
          x="${x}"
          y="${y}"
          class="watermark"
          transform="rotate(-30, ${x}, ${y})"
        >${text}</text>
      `;
    }
  }

  const svgOverlay = `
    <svg width="${metadata.width}" height="${metadata.height}">
      <style>
        .watermark {
          fill: ${color};
          font-size: ${fontSize}px;
          font-family: Arial, sans-serif;
          opacity: ${opacity};
        }
      </style>
      ${textElements}
    </svg>
  `;

  return image
    .composite([
      {
        input: Buffer.from(svgOverlay),
        gravity: 'northwest',
      },
    ])
    .toBuffer();
};

/**
 * نجيبو معلومات الصورة
 * @param {Buffer} buffer - الصورة
 * @returns {Promise<Object>}
 */
const getImageInfo = async (buffer) => {
  const metadata = await sharp(buffer).metadata();
  
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: buffer.length,
    hasAlpha: metadata.hasAlpha,
    orientation: metadata.orientation,
  };
};

/**
 * نحولو الصورة لفورمات مختلف
 * @param {Buffer} buffer - الصورة الأصلية
 * @param {string} format - الفورمات المطلوب
 * @param {Object} options - الخيارات
 * @returns {Promise<Buffer>}
 */
const convertFormat = async (buffer, format, options = {}) => {
  const { quality = 85 } = options;
  
  let image = sharp(buffer);
  
  switch (format.toLowerCase()) {
    case 'jpeg':
    case 'jpg':
      image = image.jpeg({ quality });
      break;
    case 'png':
      image = image.png({ compressionLevel: 9 });
      break;
    case 'webp':
      image = image.webp({ quality });
      break;
    case 'avif':
      image = image.avif({ quality });
      break;
    default:
      throw new Error(`فورمات مش مدعوم: ${format}`);
  }
  
  return image.toBuffer();
};

/**
 * نعدلو على الصورة (brightness, contrast, etc.)
 * @param {Buffer} buffer - الصورة الأصلية
 * @param {Object} adjustments - التعديلات
 * @returns {Promise<Buffer>}
 */
const adjustImage = async (buffer, adjustments = {}) => {
  const {
    brightness = 1,
    saturation = 1,
    hue = 0,
    lightness = 0,
  } = adjustments;

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
  createLowResVersion,
  createThumbnail,
  addWatermark,
  addTiledWatermark,
  getImageInfo,
  convertFormat,
  adjustImage,
};
