const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper'); // Requires 'unzipper' package

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mediatheque_imported';
const ZIP_PATH = path.join(__dirname, 'mediatheque_db.zip');
const IMPORT_DIR = path.join(__dirname, 'db_export');

async function importDatabase() {
  try {
    console.log('Connecting to MongoDB at:', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    // If zip exists and export dir doesn't, extract first
    if (fs.existsSync(ZIP_PATH) && !fs.existsSync(IMPORT_DIR)) {
      console.log('Extracting zip archive...');
      await fs.createReadStream(ZIP_PATH)
        .pipe(unzipper.Extract({ path: IMPORT_DIR }))
        .promise();
      console.log('Extracted.');
    }

    if (!fs.existsSync(IMPORT_DIR)) {
      throw new Error('No db_export directory found. Please ensure the json files exist.');
    }

    const files = fs.readdirSync(IMPORT_DIR).filter(f => f.endsWith('.json'));
    console.log(`Found ${files.length} collections to import.`);

    for (const file of files) {
      const collectionName = file.replace('.json', '');
      console.log(`Importing collection: ${collectionName}`);
      const filePath = path.join(IMPORT_DIR, file);
      
      const fileData = fs.readFileSync(filePath, 'utf-8');
      const docs = JSON.parse(fileData);

      if (docs.length > 0) {
        // Drop existing collection if it exists to cleanly import
        try {
          await mongoose.connection.db.collection(collectionName).drop();
          console.log(`  Dropped existing ${collectionName} collection.`);
        } catch (e) {
          // It's ok if drop fails due to namespace not found
        }

        // Insert documents
        // Using insertMany bypasses mongoose schemas to ensure raw data inserts correctly
        await mongoose.connection.db.collection(collectionName).insertMany(docs);
        console.log(`  Inserted ${docs.length} documents into ${collectionName}`);
      } else {
        console.log(`  Skipped empty collection: ${collectionName}`);
      }
    }

    console.log('Import completed successfully.');
    process.exit(0);

  } catch (err) {
    console.error('Error importing database:', err);
    process.exit(1);
  }
}

importDatabase();
