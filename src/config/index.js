/**
 * Application Configuration / إعدادات التطبيق
 * هنا نجمعو كل الإعدادات في بلاصة وحدة
 */

// نحملو المتغيرات البيئية
require('dotenv').config();

const config = {
  // إعدادات السيرفر
  server: {
    port: parseInt(process.env.PORT, 10) || 5000,
    env: process.env.NODE_ENV || 'development',
    isDev: process.env.NODE_ENV !== 'production',
  },

  // إعدادات قاعدة البيانات
  database: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/mediatheque',
    gridFsBucket: process.env.GRIDFS_BUCKET_NAME || 'mediaFiles',
  },

  // إعدادات JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret',
    expiresIn: process.env.TOKEN_EXPIRY || '15m',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  },

  // إعدادات الدفع
  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'mock',
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
    paytech: {
      apiKey: process.env.PAYTECH_API_KEY,
      secretKey: process.env.PAYTECH_SECRET_KEY,
      webhookSecret: process.env.PAYTECH_WEBHOOK_SECRET,
    },
  },

  // إعدادات التخزين
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'gridfs',
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'eu-west-1',
      bucket: process.env.AWS_S3_BUCKET,
    },
    r2: {
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucket: process.env.R2_BUCKET_NAME,
    },
  },

  // إعدادات Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 دقيقة
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // حدود رفع الملفات (بالبايت)
  upload: {
    maxPhotoSize: (parseInt(process.env.MAX_PHOTO_SIZE_MB, 10) || 20) * 1024 * 1024,
    maxVideoSize: (parseInt(process.env.MAX_VIDEO_SIZE_MB, 10) || 500) * 1024 * 1024,
    maxAudioSize: (parseInt(process.env.MAX_AUDIO_SIZE_MB, 10) || 100) * 1024 * 1024,
  },

  // إعدادات توكن التحميل
  download: {
    tokenExpiry: process.env.DOWNLOAD_TOKEN_EXPIRY || '24h',
  },

  // CORS origins المسموح بها
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
};

// نتأكدو من المتغيرات الضرورية في البروداكشن
if (config.server.env === 'production') {
  const requiredVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'MONGO_URI'];
  const missing = requiredVars.filter((key) => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`⚠️ Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = config;
