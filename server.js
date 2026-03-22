/**
 * Server Entry Point / نقطة دخول السيرفر
 * هنا نشغلو السيرفر ونوصلو بالداتابيز
 */

// نحملو المتغيرات البيئية قبل أي حاجة
require('dotenv').config();

const app = require('./src/app');
const config = require('./src/config');
const { connectDB } = require('./src/config/database');

// باش نتعاملو مع الأخطاء الي ما متصيدينش
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION! خطأ ما متصيدش!');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

// نوصلو بالداتابيز ونشغلو السيرفر
const startServer = async () => {
  try {
    // نوصلو بالداتابيز أول
    await connectDB();

    // نشغلو السيرفر
    const server = app.listen(config.server.port, () => {
      console.log(`🚀 Server running in ${config.server.env} mode on port ${config.server.port}`);
      console.log(`📍 API available at http://localhost:${config.server.port}/api`);
      console.log(`💚 Health check: http://localhost:${config.server.port}/api/health`);
    });

    // نتعاملو مع unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('❌ UNHANDLED REJECTION! خطأ ما متعاملش معاه!');
      console.error(err.name, err.message);
      // نسكرو السيرفر بشكل نظيف
      server.close(() => {
        process.exit(1);
      });
    });

    // نتعاملو مع SIGTERM (للدوكر وهيروكو)
    process.on('SIGTERM', () => {
      console.log('👋 SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('💤 Process terminated.');
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// نشغلو كل شي
startServer();
