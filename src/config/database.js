/**
 * Database Configuration / إعدادات قاعدة البيانات
 * هنا نعملو الكونكشن مع MongoDB ونهيئو GridFS للملفات
 */

const mongoose = require('mongoose');

// متغير باش نخزنو فيه الكونكشن GridFS
let gridFSBucket = null;

/**
 * نوصلو بقاعدة البيانات MongoDB
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  try {
    // نحاولو نوصلو بالداتابيز
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // الأوبشنز الجداد ما يحتاجوش، mongoose 8 يستعملهم بالديفولت
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // كي نوصلو، نهيئو GridFSBucket للملفات الكبار
    const db = conn.connection.db;
    const { GridFSBucket } = require('mongodb');
    
    gridFSBucket = new GridFSBucket(db, {
      bucketName: process.env.GRIDFS_BUCKET_NAME || 'mediaFiles',
    });

    console.log(`📦 GridFS Bucket initialized: ${process.env.GRIDFS_BUCKET_NAME || 'mediaFiles'}`);

    return conn;
  } catch (error) {
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

/**
 * نرجعو GridFSBucket باش نستعملوه في أماكن أخرى
 * @returns {GridFSBucket}
 */
const getGridFSBucket = () => {
  if (!gridFSBucket) {
    throw new Error('GridFS مش مهيأ بعد. لازم تتصل بالداتابيز الأول');
  }
  return gridFSBucket;
};

/**
 * نسكرو الكونكشن مع الداتابيز
 * @returns {Promise<void>}
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('👋 MongoDB Disconnected');
  } catch (error) {
    console.error(`❌ Error disconnecting from MongoDB: ${error.message}`);
  }
};

module.exports = {
  connectDB,
  getGridFSBucket,
  disconnectDB,
};
