require('dotenv').config();
const mongoose = require('mongoose');

const clearDb = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mediatheque'; // Trying default if not in env but it should be
    console.log('Connecting to MongoDB...', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const collections = mongoose.connection.collections;

    for (const key in collections) {
      const collection = collections[key];
      // Only delete documents, do not drop index
      await collection.deleteMany({});
      console.log(`Cleared collection: ${key}`);
    }

    console.log('Successfully cleared all data from the database!');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing database:', error);
    process.exit(1);
  }
};

clearDb();
