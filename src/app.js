/**
 * Express Application Setup / إعداد التطبيق
 * هنا نهيئو Express ونحطو كل الميدلوير والراوتز
 */

const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');

const config = require('./config');
const errorHandler = require('./middlewares/errorHandler');
const { notFound } = require('./middlewares/notFound');

// نخليو Express يقرا الـ env
require('dotenv').config();

const app = express();

// ============================================
// Performance Middlewares / ميدلوير الأداء
// ============================================

// Compression باش نصغرو حجم الداتا الي ماشية
app.use(compression());

// ============================================
// Security Middlewares / ميدلوير الأمان
// ============================================

// Helmet باش يحمينا من الهجمات المعروفة
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // باش نخليو الملفات تتحمل
}));

// CORS باش نخليو الفرونت يتصل بينا
app.use(cors({
  origin: config.cors.origins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
}));

// Rate Limiting (Disabled as per user request)
// const limiter = rateLimit({
//   windowMs: config.rateLimit.windowMs,
//   max: config.rateLimit.maxRequests,
//   message: {
//     status: 'error',
//     message: 'طلبات ياسر! استنى شويا وعاود.',
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use('/api', limiter);

// HPP باش نحميو من HTTP Parameter Pollution
app.use(hpp());

// Mongo Sanitize باش نمنعو NoSQL Injection
app.use(mongoSanitize());

// ============================================
// Body Parsers / قراءة البيانات
// ============================================

// نقراو JSON (مع حد للحجم)
app.use(express.json({ limit: '10kb' }));

// نقراو URL-encoded data
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ============================================
// Health Check / فحص صحة السيرفر
// ============================================

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'السيرفر خدام مليح! 🚀',
    timestamp: new Date().toISOString(),
    environment: config.server.env,
  });
});

// ============================================
// API Routes / الراوتز
// ============================================

// نحملو الراوتز
const authRoutes = require('./routes/authRoutes');
const contentRoutes = require('./routes/contentRoutes');
const photoRoutes = require('./routes/photoRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const cartRoutes = require('./routes/cartRoutes');
const checkoutRoutes = require('./routes/checkoutRoutes');
const searchRoutes = require('./routes/searchRoutes');
const inquiryRoutes = require('./routes/inquiryRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const packRoutes = require('./routes/packRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const playlistRoutes = require('./routes/playlistRoutes');

// نربطو الراوتز بالمسارات متاعهم
app.use('/api/auth', authRoutes);
app.use('/api/contents', contentRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/packs', packRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/playlists', playlistRoutes);

// ============================================
// Error Handling / معالجة الأخطاء
// ============================================

// 404 للطلبات الي ما لقيناش ليها راوت
app.use(notFound);

// Error handler للأخطاء الكل
app.use(errorHandler);

module.exports = app;
